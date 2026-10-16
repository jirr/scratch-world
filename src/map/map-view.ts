import { GPUInitializationError, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MoveMode } from '../domain/speed-mode';
import { installDebugOverlay } from './fog/debug-overlay';
import { FogLayer } from './fog/fog-layer';
import { resolveStyleUrl, type Appearance } from './styles';

setWorkerUrl(workerUrl);

/** Pictogramme de position selon la vitesse : à l'arrêt, à pied, en trottinette, en véhicule. */
const PIN_ICONS: Record<MoveMode, { icon: string; label: string }> = {
  idle: { icon: '🧍', label: 'Ta position (à l’arrêt)' },
  walk: { icon: '🚶', label: 'Ta position (à pied)' },
  scooter: { icon: '🛴', label: 'Ta position (en trottinette)' },
  vehicle: { icon: '🚗', label: 'Ta position (en véhicule)' },
};

const CAMERA_KEY = 'sw:camera';
const DEFAULT_CAMERA = { lng: 10, lat: 30, zoom: 1.5 };
const MIN_LOCATE_ZOOM = 15;

interface Camera {
  lng: number;
  lat: number;
  zoom: number;
}

function loadCamera(): Camera {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CAMERA_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      const { lng, lat, zoom } = raw as Record<string, unknown>;
      if ([lng, lat, zoom].every((v) => typeof v === 'number' && Number.isFinite(v))) {
        return { lng, lat, zoom } as Camera;
      }
    }
  } catch {
    // caméra illisible : valeurs par défaut
  }
  return DEFAULT_CAMERA;
}

export class WebGL2RequiredError extends Error {
  constructor() {
    super('WebGL2 requis');
    this.name = 'WebGL2RequiredError';
  }
}

export class MapView {
  readonly map: MapLibreMap;
  readonly fog: FogLayer;
  #removeOverlay: (() => void) | null = null;
  #marker: Marker | null = null;
  #pin: HTMLDivElement | null = null;
  #styleUrl: string;

  /** @throws {WebGL2RequiredError} si WebGL2 est indisponible. */
  constructor(container: HTMLElement, appearance: Appearance) {
    const camera = loadCamera();
    this.#styleUrl = resolveStyleUrl(appearance);
    try {
      this.map = new MapLibreMap({
        container,
        style: this.#styleUrl,
        center: [camera.lng, camera.lat],
        zoom: camera.zoom,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: true,
        attributionControl: { compact: true },
      });
    } catch (error) {
      if (error instanceof GPUInitializationError) throw new WebGL2RequiredError();
      throw error;
    }
    this.fog = new FogLayer(this.map, appearance.dark);
    this.map.on('style.load', () => this.fog.attach());
    if (new URLSearchParams(location.search).get('debug') === '1') {
      this.#removeOverlay = installDebugOverlay(this.fog);
    }
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disableRotation();
    this.map.on('moveend', () => {
      const { lng, lat } = this.map.getCenter();
      localStorage.setItem(CAMERA_KEY, JSON.stringify({ lng, lat, zoom: this.map.getZoom() }));
    });
  }

  /** Applique le style choisi (ne recharge la carte que si l'URL change) et le thème du brouillard. */
  setAppearance(appearance: Appearance): void {
    const url = resolveStyleUrl(appearance);
    if (url !== this.#styleUrl) {
      this.#styleUrl = url;
      this.map.setStyle(url);
    }
    this.fog.setDark(appearance.dark);
  }

  /** Place le marqueur de position sans bouger la caméra. */
  setPosition(lng: number, lat: number, mode: MoveMode = 'idle'): void {
    if (!this.#marker) {
      this.#pin = document.createElement('div');
      this.#pin.className = 'pin';
      this.#pin.setAttribute('role', 'img');
      this.#pin.innerHTML =
        '<span class="pin-ring"></span><span class="pin-shadow"></span><span class="pin-figure"></span>';
      this.#marker = new Marker({ element: this.#pin, anchor: 'center' });
    }
    if (this.#pin && this.#pin.dataset.mode !== mode) {
      this.#pin.dataset.mode = mode;
      const figure = this.#pin.querySelector('.pin-figure');
      if (figure) figure.textContent = PIN_ICONS[mode].icon;
      this.#pin.setAttribute('aria-label', PIN_ICONS[mode].label);
    }
    this.#marker.setLngLat([lng, lat]).addTo(this.map);
  }

  showPosition(lng: number, lat: number, mode: MoveMode = 'idle'): void {
    this.setPosition(lng, lat, mode);
    this.map.flyTo({ center: [lng, lat], zoom: Math.max(this.map.getZoom(), MIN_LOCATE_ZOOM) });
  }

  destroy(): void {
    this.#removeOverlay?.();
    this.map.remove();
    this.fog.destroy();
  }
}
