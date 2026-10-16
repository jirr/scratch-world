import type { Stats } from '../domain/stats';

export interface StatsWorkerApi {
  /** Recalcule les statistiques (rattachement aux pays mis en cache dans `regionCache`). */
  compute(): Promise<Stats>;
}
