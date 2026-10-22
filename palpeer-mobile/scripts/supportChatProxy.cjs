/**
 * Dev-only Metro middleware: proxies /support-chat-api/* → Support-Ticketing API
 * so Expo web (browser CORS) can reach https://app.palpeer.com.ng/api.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

const PREFIX = '/support-chat-api';
const TARGET = (process.env.EXPO_PUBLIC_SUPPORT_CHAT_API_BASE_URL || 'https://app.palpeer.com.ng/api').replace(
  /\/+$/,
  '',
);

function enhanceSupportChatProxy(middleware) {
  return (req, res, next) => {
    const rawUrl = req.url || '';
    // Match /support-chat-api and /support-chat-api/...
    if (rawUrl !== PREFIX && !rawUrl.startsWith(`${PREFIX}/`) && !rawUrl.startsWith(`${PREFIX}?`)) {
      return middleware(req, res, next);
    }

    const suffix = rawUrl.slice(PREFIX.length) || '/';
    const targetUrl = new URL(`${TARGET}${suffix.startsWith('/') ? suffix : `/${suffix}`}`);
    const lib = targetUrl.protocol === 'http:' ? http : https;
    const headers = { ...req.headers, host: targetUrl.host };
    delete headers.origin;
    delete headers.referer;
    // Let the upstream set content-length from the piped body.
    delete headers['content-length'];

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': req.headers.origin || '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers':
          req.headers['access-control-request-headers'] || 'content-type,authorization,accept',
        'access-control-max-age': '86400',
      });
      res.end();
      return;
    }

    const proxyReq = lib.request(
      targetUrl,
      {
        method: req.method,
        headers,
      },
      (proxyRes) => {
        const outHeaders = { ...proxyRes.headers };
        outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
        outHeaders['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
        outHeaders['access-control-allow-headers'] =
          req.headers['access-control-request-headers'] || 'content-type,authorization,accept';
        res.writeHead(proxyRes.statusCode || 502, outHeaders);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (error) => {
      if (!res.headersSent) {
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'access-control-allow-origin': req.headers.origin || '*',
        });
      }
      res.end(JSON.stringify({ message: `Support chat proxy failed: ${error.message}` }));
    });

    req.pipe(proxyReq);
  };
}

module.exports = { enhanceSupportChatProxy, SUPPORT_CHAT_PROXY_PREFIX: PREFIX };
