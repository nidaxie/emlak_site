import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import path from 'node:path';

const distDir = path.resolve(import.meta.dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');
const rawPort = process.env.WEB_PORT || process.env.PORT || '3000';
const parsedPort = Number(rawPort);
const port = Number.isNaN(parsedPort) || parsedPort <= 0 ? 3000 : parsedPort;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'expect',
]);

function isApiPath(pathname) {
  return pathname === '/api/v1' || pathname.startsWith('/api/v1/');
}

function writePlain(res, status, body) {
  res.writeHead(status, {
    ...securityHeaders,
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function proxyApi(req, res) {
  const rawTarget = process.env.API_PROXY_TARGET;
  if (!rawTarget) {
    writePlain(res, 404, 'Not Found');
    return;
  }

  let target;
  try {
    target = new URL(rawTarget);
  } catch {
    writePlain(res, 502, 'Bad Gateway');
    return;
  }

  if (target.protocol !== 'http:') {
    writePlain(res, 502, 'Bad Gateway');
    return;
  }

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || hopByHop.has(key) || key === 'host') {
      continue;
    }
    headers[key] = value;
  }

  const proxyReq = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      method: req.method,
      path: req.url,
      headers,
    },
    (proxyRes) => {
      const responseHeaders = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value === undefined || hopByHop.has(key)) {
          continue;
        }
        responseHeaders[key] = value;
      }
      res.writeHead(proxyRes.statusCode || 502, responseHeaders);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      writePlain(res, 502, 'Bad Gateway');
      return;
    }
    res.destroy();
  });

  req.on('aborted', () => proxyReq.destroy());
  req.on('error', () => proxyReq.destroy());
  req.pipe(proxyReq);
}

const server = createServer((req, res) => {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    writePlain(res, 400, 'Bad Request');
    return;
  }

  if (isApiPath(pathname)) {
    proxyApi(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const normalized = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = path.resolve(distDir, `.${normalized}`);
  const rootWithSep = distDir.endsWith(path.sep) ? distDir : `${distDir}${path.sep}`;

  if (candidate !== distDir && !candidate.startsWith(rootWithSep)) {
    res.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  let fileToServe = null;
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else if (!path.extname(normalized) && existsSync(indexPath)) {
    fileToServe = indexPath;
  }

  if (!fileToServe) {
    res.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const isAsset = normalized.startsWith('/assets/') || normalized.startsWith('\\assets\\');
  const cacheControl = isAsset
    ? 'public, max-age=31536000, immutable'
    : ext === '.html'
      ? 'no-cache'
      : 'public, max-age=3600';

  res.writeHead(200, {
    ...securityHeaders,
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(fileToServe).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Web static server listening on http://localhost:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
