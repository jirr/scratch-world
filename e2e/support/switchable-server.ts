import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export interface SwitchableServerOptions {
  port?: number;
  /** Chemin sous lequel l'application est servie. */
  basePath?: string;
  currentDir?: string;
  nextDir?: string;
}

export interface SwitchableServer {
  /** URL de l'application, avec le chemin de base. */
  url: string;
  close(): Promise<void>;
}

/**
 * Serveur statique qui sert `dist/` puis, après `GET /__switch?to=next`, `dist-next/`.
 * Tout est servi `no-cache` : seule la bascule décide de la version visible.
 */
export async function startSwitchableServer(
  options: SwitchableServerOptions = {},
): Promise<SwitchableServer> {
  const { port = 4174, basePath = '/scratch-world/' } = options;
  const roots = {
    current: resolve(options.currentDir ?? 'dist'),
    next: resolve(options.nextDir ?? 'dist-next'),
  };
  let active: keyof typeof roots = 'current';

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname === '/__switch') {
        active = url.searchParams.get('to') === 'next' ? 'next' : 'current';
        res.writeHead(200, { 'Cache-Control': 'no-store' }).end(active);
        return;
      }
      if (!url.pathname.startsWith(basePath)) {
        res.writeHead(404).end();
        return;
      }
      const root = roots[active];
      const relative = decodeURIComponent(url.pathname.slice(basePath.length)) || 'index.html';
      let file = resolve(join(root, normalize(relative)));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const found = await stat(file).catch(() => null);
      if (!found?.isFile()) {
        // Repli SPA pour les chemins sans extension uniquement.
        if (extname(relative) !== '') {
          res.writeHead(404).end();
          return;
        }
        file = join(root, 'index.html');
      }
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      createReadStream(file).pipe(res);
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', done);
  });

  return {
    url: `http://localhost:${port}${basePath}`,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
