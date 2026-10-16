# Scratch World

[![CI](https://github.com/jirr/scratch-world/actions/workflows/ci.yml/badge.svg)](https://github.com/jirr/scratch-world/actions/workflows/ci.yml)
[![Deploy](https://github.com/jirr/scratch-world/actions/workflows/deploy.yml/badge.svg)](https://github.com/jirr/scratch-world/actions/workflows/deploy.yml)

PWA « carte du monde à gratter » : un brouillard sombre recouvre la carte et se dissipe sur les zones où tu es allé (position en direct quand l'app est ouverte, ou import GPX / KML / Google Timeline).

**Local-first : aucun backend, aucune donnée de localisation ne quitte l'appareil.**

Application : <https://jirr.github.io/scratch-world/>

> État d'avancement : le projet est livré par jalons (voir les PR). Le jalon 0 pose le dépôt, la CI, le déploiement et le mécanisme de mise à jour de la PWA ; la carte arrive au jalon 1.

## Développement

Prérequis : Node ≥ 22.12 (`.nvmrc` : 24) et pnpm 12.

```sh
corepack enable          # ou : npm i -g pnpm@12.14.0
pnpm install
pnpm dev
```

| Script                   | Rôle                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `pnpm dev`               | Serveur de développement Vite                                      |
| `pnpm build`             | Build de production dans `dist/` (`BASE_PATH` pour la base)        |
| `pnpm build:e2e-next`    | Build « version suivante » dans `dist-next/` (test de mise à jour) |
| `pnpm preview`           | Sert `dist/` sur le port 4173                                      |
| `pnpm lint`              | ESLint (dont règles de frontières entre couches) + Prettier        |
| `pnpm typecheck`         | `tsc` + `svelte-check`                                             |
| `pnpm test` / `test:cov` | Vitest (avec couverture)                                           |
| `pnpm e2e`               | Playwright (Chromium)                                              |

Les tests de bout en bout s'exécutent sur un build servi sous `/scratch-world/` :

```sh
BASE_PATH=/scratch-world/ pnpm build
BASE_PATH=/scratch-world/ pnpm build:e2e-next
pnpm exec playwright install chromium
pnpm e2e --project=app --project=pwa
```

## Architecture

TypeScript strict, Svelte 5 (sans SvelteKit), Vite. Les couches sont séparées et la direction des dépendances est imposée par ESLint (`no-restricted-imports`) :

- `src/domain/` : logique pure (sans DOM, sans stockage)
- `src/data/`, `src/import/` : stockage et import, indépendants de l'UI et de la carte
- `src/ui/` : composants Svelte ; n'accède pas à IndexedDB directement
- `src/app/` : composition (mise à jour de la PWA, registre « occupé »)
- `src/sw.ts` : service worker (precache + caches de tuiles)

## Mise à jour de la PWA

Le service worker est enregistré en mode `prompt` : une nouvelle version ne remplace jamais l'ancienne sans accord. L'application vérifie la présence d'une mise à jour au retour au premier plan et toutes les heures, puis affiche « Nouvelle version disponible ». Le toast est **différé tant qu'une opération longue est en cours** (import, enregistrement, restauration). La version affichée (`vX.Y.Z (sha)`) permet de vérifier ce qui tourne.

Le test `e2e/pwa-update.spec.ts` simule un déploiement : un serveur local sert `dist/` puis bascule sur `dist-next/`.

GitHub Pages impose `Cache-Control: max-age=600` sur tous les fichiers et ce n'est pas configurable. Une mise à jour est donc détectée au plus tard ~10 minutes après un déploiement (`sw.js` est malgré tout revalidé hors cache HTTP par le navigateur). `public/_headers` fournit de vrais en-têtes sur Cloudflare Pages : voir [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

## CI/CD

- `ci.yml` (push sur `main` et pull requests) : `quality` (lint, typecheck, tests), `build`, `e2e` (Playwright), `lighthouse`.
- `deploy.yml` : après une CI verte sur `main`, publie sur GitHub Pages **l'artefact `dist` exact produit par la CI** (pas de second build).

Lighthouse 12 n'a plus de catégorie PWA : il audite performance, accessibilité et bonnes pratiques (seuils en avertissement pour l'instant). L'installabilité et le hors-ligne sont vérifiés par Playwright.

### Protection de branche recommandée

Sur `main` : pull request obligatoire, branche à jour, et checks requis `quality`, `build`, `e2e`, `lighthouse`. Aucune fusion sans validation.

## Tester sur téléphone

La géolocalisation et l'installation exigent HTTPS. Options :

- tester directement sur <https://jirr.github.io/scratch-world/> ;
- `pnpm build && pnpm preview --host`, puis `cloudflared tunnel --url http://localhost:4173` (les hôtes `*.trycloudflare.com` sont autorisés) ;
- `mkcert` avec un certificat local installé sur le téléphone.

## Limites connues

Une PWA ne peut pas suivre la position en arrière-plan : l'enregistrement en direct n'est actif que l'application ouverte. L'abstraction `PositionSource` prépare une enveloppe Capacitor.

## Données personnelles

Ne commitez jamais de données de localisation réelles (`Records.json`, `Timeline.json`, sauvegardes `.json.gz` sont ignorés par `.gitignore`). Les jeux de test du dépôt sont fictifs ou synthétiques.
