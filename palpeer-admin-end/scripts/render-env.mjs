import { writeFileSync } from 'node:fs';

const origin = (process.env.PALPEER_API_ORIGIN || '').trim().replace(/\/$/, '');
if (!origin.startsWith('https://')) {
  console.error('PALPEER_API_ORIGIN must be the API https origin (Render RENDER_EXTERNAL_URL).');
  process.exit(1);
}

const wsOrigin = origin.replace(/^https:/i, 'wss:');
const tightCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${origin} ${wsOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const body = [
  `VITE_API_BASE_URL=${origin}/api/v1`,
  `VITE_WS_URL=${origin}/ws`,
  'VITE_APP_ENV=production',
  'VITE_USE_MOCK_API=false',
  '',
].join('\n');

writeFileSync(new URL('../.env.production.local', import.meta.url), body);
console.log(`Wrote .env.production.local for ${origin}`);
console.log(
  'Recommended Render CSP (tighten Dashboard header if Blueprint still uses https:/wss:):',
);
console.log(tightCsp);
