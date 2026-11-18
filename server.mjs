import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const requested = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
    if (!requested.startsWith(root)) throw new Error('Invalid path');
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
server.listen(port, '127.0.0.1', () => console.log(`Võ Linh Đấu Trường: http://localhost:${port}`));
