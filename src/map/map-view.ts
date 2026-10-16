import { GPUInitializationError, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { autoStyleUrl } from './styles';

setWorkerUrl(workerUrl);

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
  #marker: Marker | null = null;
  #colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  #onSchemeChange = () => this.map.setStyle(autoStyleUrl(this.#colorScheme.matches));

  /** @throws {WebGL2RequiredError} si WebGL2 est indisponible. */
  constructor(container: HTMLElement) {
    const camera = loadCamera();
    try {
      this.map = new MapLibreMap({
        container,
        style: autoStyleUrl(this.#colorScheme.matches),
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
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disableRotation();
    this.map.on('moveend', () => {
      const { lng, lat } = this.map.getCenter();
      localStorage.setItem(CAMERA_KEY, JSON.stringify({ lng, lat, zoom: this.map.getZoom() }));
    });
    this.#colorScheme.addEventListener('change', this.#onSchemeChange);
  }

  showPosition(lng: number, lat: number): void {
    this.#marker ??= new Marker({ color: '#e5484d' });
    this.#marker.setLngLat([lng, lat]).addTo(this.map);
    this.map.flyTo({ center: [lng, lat], zoom: Math.max(this.map.getZoom(), MIN_LOCATE_ZOOM) });
  }

  destroy(): void {
    this.#colorScheme.removeEventListener('change', this.#onSchemeChange);
    this.map.remove();
  }
}
