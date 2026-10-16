export interface FogBucket {
  key: string;
  version: number;
  origin: [number, number];
  /** [dx, dy, r] × n, relatifs à `origin` (unités Mercator). */
  instances: Float32Array;
}

export interface FogRequest {
  res: number;
  bbox: [number, number, number, number];
  /** Versions déjà détenues côté appelant : ces buckets ne sont pas renvoyés. */
  have: Record<string, number>;
}

export interface FogResponse {
  /** Ensemble complet des buckets visibles (clé + version). */
  visible: { key: string; version: number }[];
  /** Buckets nouveaux ou modifiés depuis `have`. */
  buckets: FogBucket[];
  /** Nombre total de cellules stockées. */
  cellCount: number;
}

export interface FogWorkerApi {
  init(
    onInvalidate: (bucketKeys: string[]) => void,
  ): Promise<{ cellCount: number; chunkCount: number }>;
  getBuckets(request: FogRequest): Promise<FogResponse>;
}
