import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = join(process.cwd(), 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function safePathname(pathname) {
  const normalized = normalize(pathname).replace(/^\.+[\\/]/, '');
  if (normalized.includes('..')) {
    return null;
  }
  return normalized;
}

async function resolveRequestPath(urlPath) {
  const cleanPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const sanitized = safePathname(cleanPath);
  if (!sanitized) {
    return null;
  }

  const filePath = join(DIST_DIR, sanitized);
  if (!existsSync(filePath)) {
    return join(DIST_DIR, 'index.html');
  }

  const fileStat = await stat(filePath);
  if (fileStat.isDirectory()) {
    return join(filePath, 'index.html');
  }

  return filePath;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const filePath = await resolveRequestPath(url.pathname);

    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });

    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Root Breach server listening on port ${PORT}`);
});
