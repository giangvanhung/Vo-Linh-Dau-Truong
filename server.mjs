import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { attachLan } from './lan-server.mjs';
import { loadFighterConfig } from './scripts/fighter-config.mjs';
import { bundleGame } from './scripts/game-bundle.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
mime['.mp3'] = 'audio/mpeg';
mime['.ogg'] = 'audio/ogg';
mime['.wav'] = 'audio/wav';
mime['.jpg'] = 'image/jpeg';
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const route = pathname === '/' ? '/index.html' : pathname === '/controller' ? '/controller.html' : pathname;
    if (!['/index.html', '/controller.html'].includes(route)
      && route !== '/data/fighters.json'
      && !/^\/(src|assets|styles)\//.test(route)) throw new Error('Invalid path');
    if (route.split('/').some(part => part.startsWith('.')) || route.includes('\\')) throw new Error('Invalid path');
    if (route === '/data/fighters.json') {
      const config = await loadFighterConfig();
      res.writeHead(200, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(config));
      return;
    }
    if (route === '/src/game.bundle.js') {
      const script = await bundleGame();
      res.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-cache' });
      res.end(script);
      return;
    }
    const publicRoute = /^\/(assets|styles)\//.test(route);
    const base = publicRoute ? resolve(root, 'public') : root;
    const requested = route === '/src/vendor/jsqr.js'
      ? resolve(root, 'node_modules/jsqr/dist/jsQR.js')
      : resolve(base, '.' + route);
    if (!requested.startsWith(root + sep)) throw new Error('Invalid path');
    const info = await stat(requested);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': mime[extname(requested)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(requested));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Không tìm thấy tệp.');
  }
});
const port = Number(process.env.PORT) || 5173;
attachLan(server);
server.listen(port, '0.0.0.0', () => console.log(`Võ Linh Đấu Trường: http://localhost:${port}`));
