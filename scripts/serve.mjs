// Tiny static server for local testing: node scripts/serve.mjs [port] [dir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.argv[2] || 4173);
const dir = path.resolve(process.argv[3] || 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.txt': 'text/plain' };

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(dir, url);
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': url === '/sw.js' ? 'no-cache' : 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${dir} on http://localhost:${port}`));
