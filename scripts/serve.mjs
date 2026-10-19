import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2] || 'public');
const built = process.argv[2] === 'dist';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (url === '/' || url === '/soundboard') { res.writeHead(302, { Location: '/soundboard/' }).end(); return; }
  const relative = built ? url : url.replace(/^\/soundboard\//, '/');
  const file = path.resolve(root, '.' + relative);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const info = await stat(file);
    const full = info.isDirectory() ? path.join(file, 'index.html') : file;
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': types[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(5173, '0.0.0.0', () => console.log('Local: http://localhost:5173/soundboard/'));
