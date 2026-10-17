import * as Comlink from 'comlink';
import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl';
import { GPU_CACHE_MAX_BYTES, MASK_SCALE } from '../../domain/config';
import { expandedViewBBox, mercator } from '../../domain/fog-buckets';
import { displayRes } from '../../domain/lod';
import type { FogBucket, FogWorkerApi } from '../../workers/fog-api';
import { BucketCache } from './gpu-cache';
import { clipOffset, clipScale, noiseOffset, worldCopies, type ViewState } from './math';
import { generateNoise, NOISE_SIZE } from './noise';
import { COMPOSE_FRAG, COMPOSE_VERT, MASK_FRAG, MASK_VERT } from './shaders';

const REFRESH_INTERVAL_MS = 150;
/** Part de l'opacité du brouillard conservée en mode dessin. */
const DIMMED_OPACITY = 0.5;

interface GpuBucket extends FogBucket {
  stale: boolean;
  count: number;
  vao: WebGLVertexArrayObject | null;
  vbo: WebGLBuffer | null;
}

interface Programs {
  mask: WebGLProgram;
  compose: WebGLProgram;
  maskU: Record<'scale' | 'offset', WebGLUniformLocation | null>;
  composeU: Record<
    'mask' | 'noise' | 'viewport' | 'dpr' | 'noiseOffset' | 'color' | 'opacity',
    WebGLUniformLocation | null
  >;
}

interface Mask {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export interface FogStats {
  res: number;
  buckets: number;
  instances: number;
  cells: number;
}

const THEMES = {
  dark: { color: [30 / 255, 36 / 255, 50 / 255] as const, opacity: 1 },
  light: { color: [16 / 255, 18 / 255, 24 / 255] as const, opacity: 1 },
};

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader a échoué');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader invalide : ${gl.getShaderInfoLog(shader) ?? ''}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram a échoué');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Programme invalide : ${gl.getProgramInfoLog(program) ?? ''}`);
  }
  return program;
}

/** Calque custom MapLibre : brouillard sombre dissipé autour des cellules visitées (voir le plan). */
export class FogLayer implements CustomLayerInterface {
  readonly id = 'fog';
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  #map: MapLibreMap;
  #worker = new Worker(new URL('../../workers/fog.worker.ts', import.meta.url), { type: 'module' });
  #api = Comlink.wrap<FogWorkerApi>(this.#worker);
  #cache = new BucketCache<GpuBucket>(GPU_CACHE_MAX_BYTES);
  #drawSet: GpuBucket[] = [];
  #gl: WebGL2RenderingContext | null = null;
  #programs: Programs | null = null;
  #mask: Mask | null = null;
  #quad: WebGLBuffer | null = null;
  #emptyVao: WebGLVertexArrayObject | null = null;
  #noise: WebGLTexture | null = null;
  #theme = THEMES.light;
  #hidden = false;
  #dimmed = false;
  #seq = 0;
  #lastRefresh = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #ready: Promise<void>;
  #stats: FogStats = { res: 0, buckets: 0, instances: 0, cells: 0 };
  #onMove = () => this.requestRefresh();
  #onMoveEnd = () => this.refresh();

  constructor(map: MapLibreMap, dark: boolean) {
    this.#map = map;
    this.#theme = dark ? THEMES.dark : THEMES.light;
    this.#ready = this.#api
      .init(Comlink.proxy((keys: string[]) => this.#onInvalidate(keys)))
      .then(({ cellCount }) => {
        this.#stats.cells = cellCount;
      });
  }

  get stats(): FogStats {
    return this.#stats;
  }

  /** Masque le brouillard (aperçu d'un style de carte). */
  setHidden(hidden: boolean): void {
    this.#hidden = hidden;
    this.#map.triggerRepaint();
  }

  /** Mode dessin : brouillard à moitié transparent pour deviner les zones déjà dévoilées. */
  setDimmed(dimmed: boolean): void {
    this.#dimmed = dimmed;
    this.#map.triggerRepaint();
  }

  setDark(dark: boolean): void {
    this.#theme = dark ? THEMES.dark : THEMES.light;
    this.#map.triggerRepaint();
  }

  /**
   * Ajoute le calque, ou le remonte au sommet de la pile s'il est déjà là. À rappeler après chaque
   * changement de style : le diff de style de MapLibre ajoute les nouveaux calques en fin de pile,
   * donc par-dessus le brouillard.
   */
  attach(): void {
    if (this.#map.getLayer(this.id)) this.#map.moveLayer(this.id);
    else this.#map.addLayer(this);
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    // Un style reconstruit de zéro ne rappelle pas `onRemove` sur l'ancien : on libère ici. Les
    // tableaux CPU des buckets survivent et seront ré-uploadés paresseusement.
    if (this.#gl) this.#releaseGpu(this.#gl);
    this.#gl = gl;
    this.#programs = this.#createPrograms(gl);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.#quad = quad;
    this.#emptyVao = gl.createVertexArray();
    this.#noise = this.#createNoise(gl);
    map.on('move', this.#onMove);
    map.on('moveend', this.#onMoveEnd);
    void this.#ready.then(() => this.refresh());
  }

  onRemove(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    map.off('move', this.#onMove);
    map.off('moveend', this.#onMoveEnd);
    this.#releaseGpu(gl);
    this.#gl = null;
  }

  destroy(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#worker.terminate();
  }

  /** Passe 1 : accumule les noyaux des cellules visitées dans un masque hors-écran. */
  prerender(gl: WebGL2RenderingContext): void {
    const programs = this.#programs;
    if (!programs || !this.#quad) return;
    const mask = this.#ensureMask(gl);
    const previousFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const previousViewport = gl.getParameter(gl.VIEWPORT) as Int32Array;

    gl.bindFramebuffer(gl.FRAMEBUFFER, mask.fbo);
    gl.viewport(0, 0, mask.width, mask.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const view = this.#view(gl);
    const copies = worldCopies(view);
    const [sx, sy] = clipScale(view);
    gl.useProgram(programs.mask);
    gl.uniform2f(programs.maskU.scale, sx, sy);
    let drawnBuckets = 0;
    let drawnInstances = 0;
    for (const bucket of this.#drawSet) {
      this.#ensureGpu(gl, bucket);
      gl.bindVertexArray(bucket.vao);
      for (const k of copies) {
        const [ox, oy] = clipOffset(view, bucket.origin[0] + k, bucket.origin[1]);
        gl.uniform2f(programs.maskU.offset, ox, oy);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, bucket.count);
      }
      drawnBuckets++;
      drawnInstances += bucket.count * copies.length;
    }
    gl.bindVertexArray(null);
    this.#stats.buckets = drawnBuckets;
    this.#stats.instances = drawnInstances;

    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFbo);
    gl.viewport(
      previousViewport[0] ?? 0,
      previousViewport[1] ?? 0,
      previousViewport[2] ?? 0,
      previousViewport[3] ?? 0,
    );
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Passe 2 : compose le brouillard plein écran, percé là où le masque est fort. */
  render(gl: WebGL2RenderingContext): void {
    const programs = this.#programs;
    if (!programs || !this.#mask || this.#hidden) return;
    const view = this.#view(gl);
    const dpr = gl.drawingBufferWidth / view.width;
    const [nx, ny] = noiseOffset(view, NOISE_SIZE);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(programs.compose);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#mask.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.#noise);
    gl.uniform1i(programs.composeU.mask, 0);
    gl.uniform1i(programs.composeU.noise, 1);
    gl.uniform2f(programs.composeU.viewport, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(programs.composeU.dpr, dpr);
    gl.uniform2f(programs.composeU.noiseOffset, nx, ny);
    gl.uniform3f(programs.composeU.color, ...this.#theme.color);
    const opacity = this.#theme.opacity * (this.#dimmed ? DIMMED_OPACITY : 1);
    gl.uniform1f(programs.composeU.opacity, opacity);
    gl.bindVertexArray(this.#emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  requestRefresh(): void {
    if (this.#timer) return;
    const wait = Math.max(0, REFRESH_INTERVAL_MS - (performance.now() - this.#lastRefresh));
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.refresh();
    }, wait);
  }

  /** Demande au worker les buckets de la vue ; l'ensemble dessiné ne change qu'une fois complet. */
  async refresh(): Promise<void> {
    if (!this.#gl) return;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#lastRefresh = performance.now();
    await this.#ready;
    const view = this.#view(this.#gl);
    const center = this.#map.getCenter();
    const res = displayRes(view.zoom, center.lat);
    const seq = ++this.#seq;
    const response = await this.#api.getBuckets({
      res,
      bbox: expandedViewBBox(center.lng, center.lat, view.zoom, view.width, view.height),
      have: this.#cache.versions(),
    });
    if (seq !== this.#seq || !this.#gl) return;

    const replaced: GpuBucket[] = [];
    for (const bucket of response.buckets) {
      const old = this.#cache.set({
        ...bucket,
        stale: false,
        count: bucket.instances.length / 3,
        vao: null,
        vbo: null,
      });
      if (old) replaced.push(old);
    }
    this.#drawSet = response.visible.flatMap(({ key }) => this.#cache.get(key) ?? []);
    const pinned = new Set(this.#drawSet.map((b) => b.key));
    const dead = [
      ...replaced.filter((b) => !this.#drawSet.includes(b)),
      ...this.#cache.evict(pinned),
    ];
    for (const bucket of dead) this.#freeGpu(this.#gl, bucket);
    this.#stats.res = res;
    this.#stats.cells = response.cellCount;
    this.#map.triggerRepaint();
  }

  #onInvalidate(keys: string[]): void {
    this.#cache.markStale(keys);
    void this.refresh();
  }

  #view(gl: WebGL2RenderingContext): ViewState {
    const canvas = gl.canvas as HTMLCanvasElement;
    const center = this.#map.getCenter();
    const [cx, cy] = mercator(center.lat, center.lng);
    return {
      cx,
      cy,
      zoom: this.#map.getZoom(),
      width: canvas.clientWidth || 1,
      height: canvas.clientHeight || 1,
    };
  }

  #ensureGpu(gl: WebGL2RenderingContext, bucket: GpuBucket): void {
    if (bucket.vao) return;
    bucket.vao = gl.createVertexArray();
    bucket.vbo = gl.createBuffer();
    gl.bindVertexArray(bucket.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bucket.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, bucket.instances, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 12, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }

  #freeGpu(gl: WebGL2RenderingContext, bucket: GpuBucket): void {
    if (bucket.vao) gl.deleteVertexArray(bucket.vao);
    if (bucket.vbo) gl.deleteBuffer(bucket.vbo);
    bucket.vao = null;
    bucket.vbo = null;
  }

  #releaseGpu(gl: WebGL2RenderingContext): void {
    for (const bucket of this.#cache.values()) this.#freeGpu(gl, bucket);
    if (this.#mask) {
      gl.deleteFramebuffer(this.#mask.fbo);
      gl.deleteTexture(this.#mask.texture);
      this.#mask = null;
    }
    if (this.#programs) {
      gl.deleteProgram(this.#programs.mask);
      gl.deleteProgram(this.#programs.compose);
      this.#programs = null;
    }
    gl.deleteBuffer(this.#quad);
    gl.deleteVertexArray(this.#emptyVao);
    gl.deleteTexture(this.#noise);
    this.#quad = this.#emptyVao = this.#noise = null;
  }

  #ensureMask(gl: WebGL2RenderingContext): Mask {
    const width = Math.max(1, Math.ceil(gl.drawingBufferWidth * MASK_SCALE));
    const height = Math.max(1, Math.ceil(gl.drawingBufferHeight * MASK_SCALE));
    if (this.#mask && this.#mask.width === width && this.#mask.height === height) return this.#mask;
    if (this.#mask) {
      gl.deleteFramebuffer(this.#mask.fbo);
      gl.deleteTexture(this.#mask.texture);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
    this.#mask = { fbo, texture, width, height };
    return this.#mask;
  }

  #createPrograms(gl: WebGL2RenderingContext): Programs {
    const mask = link(gl, MASK_VERT, MASK_FRAG);
    const compose = link(gl, COMPOSE_VERT, COMPOSE_FRAG);
    const u = (program: WebGLProgram, name: string) => gl.getUniformLocation(program, name);
    return {
      mask,
      compose,
      maskU: { scale: u(mask, 'u_scale'), offset: u(mask, 'u_offset') },
      composeU: {
        mask: u(compose, 'u_mask'),
        noise: u(compose, 'u_noise'),
        viewport: u(compose, 'u_viewport'),
        dpr: u(compose, 'u_dpr'),
        noiseOffset: u(compose, 'u_noiseOffset'),
        color: u(compose, 'u_color'),
        opacity: u(compose, 'u_opacity'),
      },
    };
  }

  #createNoise(gl: WebGL2RenderingContext): WebGLTexture {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      NOISE_SIZE,
      NOISE_SIZE,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      generateNoise(),
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return texture;
  }
}
