# Scratch World

[![CI](https://github.com/jirr/scratch-world/actions/workflows/ci.yml/badge.svg)](https://github.com/jirr/scratch-world/actions/workflows/ci.yml)
[![Deploy](https://github.com/jirr/scratch-world/actions/workflows/deploy.yml/badge.svg)](https://github.com/jirr/scratch-world/actions/workflows/deploy.yml)

PWA « carte du monde à gratter » : un brouillard sombre recouvre la carte et se dissipe sur les zones où tu es allé (position en direct quand l'app est ouverte, ou import GPX / KML / Google Timeline).

**Local-first : aucun backend, aucune donnée de localisation ne quitte l'appareil.**

Application : <https://jirr.github.io/scratch-world/>

## Fonctionnalités

- Carte du monde voilée d’un brouillard (WebGL2) qui se dissipe sur les zones visitées, nord en haut.
- **Grattage en direct** avec la géolocalisation du navigateur (application ouverte).
- **Import** GPX, KML, Google Timeline (Android et iPhone) et `Records.json`.
- **Statistiques** : page plein écran à sections dépliables (monde, pays, région, département) avec une barre de progression par zone.
- **Sauvegarde / restauration** (fusion), réglages, thèmes clair/sombre, hors ligne, installable.
- **Français et anglais** : langue du système par défaut (anglais si elle n’est ni le français ni l’anglais), modifiable dans les réglages.

Résolution H3 10 (arête moyenne ≈ 76 m, aire ≈ 0,015 km² par cellule) ; les cellules sont stockées en chunks binaires par parent H3 de résolution 5 dans IndexedDB.

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

## Brouillard

Calque custom MapLibre (WebGL2) : un masque hors-écran à demi-résolution accumule un noyau radial par cellule visitée (instancié, par buckets H3 construits dans `fog.worker`), puis une passe plein écran compose le brouillard avec un grain. Ajoute `?debug=1` à l’URL pour afficher FPS, résolution d’affichage, buckets/instances dessinés et nombre de cellules. `pnpm gen:cells [n]` produit une sauvegarde synthétique dans `perf/`. Un exemple de mesure est dans [docs/m03-perf-report.json](docs/m03-perf-report.json).

## Import

Formats : GPX, KML (dont `gx:Track`), Google Timeline Android (`semanticSegments`) et iPhone (tableau en racine), `Records.json`. Les JSON sont lus **en flux** (jamais chargés entièrement), dans `import.worker`. L’import est idempotent : l’empreinte SHA-256 (premier Mio ‖ dernier Mio ‖ taille) détecte un fichier déjà importé. Non gérés : l’ancien « Semantic Location History » (`timelineObjects`) et les archives ZIP Takeout (dézipper d’abord). `pnpm gen:fixtures` régénère les fichiers fictifs de `tests/fixtures/import` ; `--large` produit un `perf/records-large.json` de 200 Mo.

## Statistiques

Page plein écran en quatre sections dépliables : **Monde** (surface dévoilée, nombre de cellules, part du **monde émergé** = somme des surfaces des pays Natural Earth 1:50m v5.1.2, domaine public), **Pays**, **Région** et **Département** (France métropolitaine, [gregoiredavid/france-geojson](https://github.com/gregoiredavid/france-geojson), versions simplifiées). Chaque zone s'affiche dès qu'une cellule dévoilée s'y trouve, avec une barre de progression et son pourcentage, triées par pourcentage décroissant. Chaque cellule de résolution 7 (~1,4 km) est rattachée à un pays par point-dans-polygone (centre, puis sommets pour les cellules côtières, sinon « mer ») dans `stats.worker` ; les cellules françaises sont ensuite rattachées à leur région et leur département. Le résultat est mis en cache dans la table `regionCache`, invalidée si la version des jeux de données change. `pnpm build:countries` régénère `public/data/countries-50m.v1.json` et `pnpm build:france` régénère `public/data/france-admin.v1.json`.

## Sauvegarde et réglages

Réglages > Données : **Sauvegarder** télécharge `scratch-world-AAAA-MM-JJ.json.gz` (cellules, imports, et traces brutes si la case est cochée) ; **Restaurer** _fusionne_ (union des cellules, jamais de suppression) et refuse un fichier d’une version plus récente ou d’une autre résolution ; **Tout effacer** demande confirmation (focus sur Annuler) et conserve les réglages. Réglages : précision maximale (10–200 m), traces brutes (désactivées par défaut), thème, langue (système, français ou anglais), style de carte (OpenFreeMap ou URL https personnalisée), écran allumé par défaut.

Les textes de l’interface sont dans `src/ui/i18n/` : `fr.ts` définit la structure (`Messages`), `en.ts` doit la respecter (vérifié par TypeScript).

## Mise à jour de la PWA

Le service worker est enregistré en mode `prompt` : une nouvelle version ne remplace jamais l'ancienne sans accord. L'application vérifie la présence d'une mise à jour au retour au premier plan et toutes les heures, puis affiche « Nouvelle version disponible ». Le toast est **différé tant qu'une opération longue est en cours** (import, enregistrement, restauration). La version affichée (`vX.Y.Z (sha)`) permet de vérifier ce qui tourne.

Le test `e2e/pwa-update.spec.ts` simule un déploiement : un serveur local sert `dist/` puis bascule sur `dist-next/`.

GitHub Pages impose `Cache-Control: max-age=600` sur tous les fichiers et ce n'est pas configurable. Une mise à jour est donc détectée au plus tard ~10 minutes après un déploiement (`sw.js` est malgré tout revalidé hors cache HTTP par le navigateur). `public/_headers` fournit de vrais en-têtes sur Cloudflare Pages : voir [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

## CI/CD

- `ci.yml` (push sur `main` et pull requests) : `quality` (lint, typecheck, tests), `build`, `e2e` (Playwright), `lighthouse`.
- `deploy.yml` : après une CI verte sur `main`, publie sur GitHub Pages **l'artefact `dist` exact produit par la CI** (pas de second build).

Lighthouse 12 n'a plus de catégorie PWA : il audite performance, accessibilité et bonnes pratiques. Seuils **bloquants** : accessibilité ≥ 0,95, bonnes pratiques ≥ 0,9, performance ≥ 0,35 (médiane mesurée en CI : 0,40 en émulation mobile avec rendu WebGL logiciel, moins 0,05 ; voir [docs/performance.md](docs/performance.md)). L'installabilité et le hors-ligne sont vérifiés par Playwright.

### Protection de branche recommandée

Sur `main` : pull request obligatoire, branche à jour, et checks requis `quality`, `build`, `e2e`, `lighthouse`. Aucune fusion sans validation.

## Tester sur téléphone

La géolocalisation et l'installation exigent HTTPS. Options :

- tester directement sur <https://jirr.github.io/scratch-world/> ;
- `pnpm build && pnpm preview --host`, puis `cloudflared tunnel --url http://localhost:4173` (les hôtes `*.trycloudflare.com` sont autorisés) ;
- `mkcert` avec un certificat local installé sur le téléphone.

## Tests et documentation

- Tests unitaires et e2e : voir les scripts ci-dessus (`pnpm test:cov`, `pnpm e2e`) ; mesures de performance : [docs/performance.md](docs/performance.md).
- Vérification sur appareils réels : [docs/manual-test-checklist.md](docs/manual-test-checklist.md) (**à exécuter sur Android et iPhone**).

## Limites connues

Une PWA ne peut pas suivre la position en arrière-plan : l'enregistrement en direct n'est actif que l'application ouverte. L'abstraction `PositionSource` prépare une enveloppe Capacitor.

## Données personnelles

Ne commitez jamais de données de localisation réelles (`Records.json`, `Timeline.json`, sauvegardes `.json.gz` sont ignorés par `.gitignore`). Les jeux de test du dépôt sont fictifs ou synthétiques.
