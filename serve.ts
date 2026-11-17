// A tiny static server for game/ (Node 22, standard library only), so an
// entry can be played locally without a build step:
//
//   node serve.ts            serves game/ on http://localhost:8080
//   node serve.ts --port 9000
//
// It sends the MIME types a browser game needs, refuses any path outside
// game/, and otherwise does nothing clever: this is a development
// convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const DEFAULT_PORT = 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function parsePort(argv: string[]): number {
  const at = argv.indexOf('--port');
  if (at === -1) return DEFAULT_PORT;
  const wanted = Number(argv[at + 1]);
  return Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : DEFAULT_PORT;
}

// Resolve a request path to a file inside game/:
//   'ok' + file — a real file under the root
//   'outside' — the path escapes game/ (refused)
//   'missing' — no such file under the root
function resolveFile(pathname: string): { status: 'ok'; file: string } | { status: 'outside' | 'missing' } {
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return { status: 'outside' };
  try {
    if (!statSync(file).isFile()) return { status: 'missing' };
  } catch {
    return { status: 'missing' };
  }
  return { status: 'ok', file };
}

function mimeFor(file: string): string {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

const port = parsePort(process.argv.slice(2));

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const resolved = resolveFile(pathname);
  if (resolved.status === 'outside') {
    response.writeHead(403).end('forbidden');
    return;
  }
  if (resolved.status === 'missing') {
    response.writeHead(404).end('not found');
    return;
  }
  const file = resolved.file;
  response.writeHead(200, {
    'content-type': mimeFor(file),
    'content-length': statSync(file).size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`game/ is on http://localhost:${port}`);
});
