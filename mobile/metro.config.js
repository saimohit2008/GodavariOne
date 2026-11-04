// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const previousEnhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const enhanced = previousEnhanceMiddleware
    ? previousEnhanceMiddleware(metroMiddleware, server)
    : metroMiddleware;

  return (req, res, next) => {
    // Transparently proxy backend API and uploads from Metro to Next.js on port 3000
    if (req.url && (req.url.startsWith('/api/') || req.url.startsWith('/uploads/'))) {
      const targetUrl = new URL(req.url, 'http://localhost:3000');
      const proxyReq = http.request(
        targetUrl,
        {
          method: req.method,
          headers: {
            ...req.headers,
            host: 'localhost:3000',
          },
        },
        (proxyRes) => {
          // Add CORS headers for web development
          const headers = { ...proxyRes.headers };
          headers['access-control-allow-origin'] = '*';
          headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
          headers['access-control-allow-headers'] = '*';
          res.writeHead(proxyRes.statusCode, headers);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on('error', (err) => {
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'access-control-allow-origin': '*',
        });
        res.end(JSON.stringify({ error: 'Metro proxy error: ' + err.message }));
      });

      req.pipe(proxyReq);
      return;
    }

    // Handle OPTIONS preflight on Metro dev server
    if (req.method === 'OPTIONS' && req.url && req.url.startsWith('/api/')) {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': '*',
      });
      res.end();
      return;
    }

    return enhanced(req, res, next);
  };
};

module.exports = config;
