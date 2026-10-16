# Mesures de performance

Toutes les mesures ci-dessous viennent d'un poste Windows (NVIDIA GeForce GTX 1660 Ti, Chrome 156 en fenêtre visible, écran 240 Hz). **Aucune n'a été faite sur téléphone** : voir la checklist manuelle (`docs/manual-test-checklist.md`, section 10).

| Scénario                               | Commande                                                                                                  | Résultat                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Brouillard, 500 000 cellules           | `pnpm build:bench && pnpm bench:fog`                                                                      | p50 4,2 ms, p95 4,3 ms, max 5,5 ms, 0 longtask > 50 ms (`m03-perf-report.json`) |
| Import d'un Records.json 200 Mo        | `pnpm gen:fixtures --large && PW_PERF=1 pnpm exec playwright test e2e/perf/import.perf.ts --project=perf` | 10 s, p95 4,3 ms pendant l'import, 0 longtask, mémoire 665 → 680 Mo             |
| Statistiques à froid, 500 000 cellules | `PW_PERF=1 pnpm exec playwright test e2e/perf/stats.perf.ts --project=perf`                               | 1,4 s (cible < 5 s), 0 longtask                                                 |

## Lighthouse (mobile, CI GitHub Actions, SwiftShader)

Lighthouse 12 n'a plus de catégorie PWA : l'installabilité et le hors-ligne sont vérifiés par Playwright. Scores mesurés en CI (3 exécutions) : performance **0,38 / 0,39 / 0,40**, accessibilité 1, bonnes pratiques 1.

La performance reste sous la cible initiale de 0,8 : en émulation mobile (CPU ralenti ×4, 4G lente, rendu WebGL logiciel), l'initialisation de MapLibre (≈ 1 Mo de JavaScript, compilation de shaders, décodage des tuiles) représente l'essentiel du Total Blocking Time (≈ 1,2 s) et retarde le LCP (≈ 5 s). Conformément au plan, le seuil bloquant de performance est fixé à **(médiane mesurée − 0,05) arrondie**, soit **0,35**, dans `lighthouserc.json` ; accessibilité ≥ 0,95 et bonnes pratiques ≥ 0,9 restent bloquantes. Le rendu GPU réel est bien plus rapide (voir ci-dessus) : ce score reflète surtout le coût d'amorçage de la carte sur CPU émulé lent.
