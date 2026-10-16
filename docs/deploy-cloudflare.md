# Déployer sur Cloudflare Pages (optionnel)

Le déploiement officiel est GitHub Pages (voir le README). Cloudflare Pages est une alternative qui permet d'appliquer les en-têtes de cache de `public/_headers`.

## Via l'intégration Git

1. Cloudflare › Workers & Pages › Create › Pages › Connect to Git, choisir `jirr/scratch-world`.
2. Réglages de build :
   - Commande de build : `pnpm build`
   - Répertoire de sortie : `dist`
   - Variables d'environnement : `BASE_PATH=/` et `NODE_VERSION=24`
3. `public/_headers` est copié dans `dist/` et appliqué : `index.html`, `sw.js` et `manifest.webmanifest` en `no-cache`, `/assets/*` en `immutable`.

## Via la CLI

```sh
BASE_PATH=/ pnpm build
pnpm dlx wrangler pages deploy dist --project-name scratch-world
```

## Pourquoi `BASE_PATH=/` ?

Sur GitHub Pages l'application vit sous `/scratch-world/` ; sur Cloudflare Pages elle est à la racine du domaine. `BASE_PATH` fixe la base de Vite, le `scope` et le `start_url` du manifest.
