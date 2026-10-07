#!/usr/bin/env node
/**
 * Serves the phone-frame preview shell that embeds Expo web (default :8081).
 *
 *   node web-emulator/server.cjs
 *   node web-emulator/server.cjs --port=3100 --app=http://localhost:8081
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

const PORT = Number(args.port || process.env.PREVIEW_PORT || 3333);
const APP_URL = args.app || process.env.EXPO_WEB_URL || 'http://localhost:8081';
const ROOT = __dirname;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // Bake the Expo URL into the page so iframe and status ping match.
    html = html.replace(
      "const APP_URL = new URLSearchParams(location.search).get('app') || 'http://localhost:8081';",
      `const APP_URL = new URLSearchParams(location.search).get('app') || ${JSON.stringify(APP_URL)};`,
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`PALPEER mobile preview: http://localhost:${PORT}`);
  console.log(`Embedding Expo web at:  ${APP_URL}`);
});
