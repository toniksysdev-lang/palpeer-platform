import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function originOf(url: string | undefined, fallback?: string): string | undefined {
  try {
    if (!url) return fallback;
    return new URL(url).origin;
  } catch {
    return fallback;
  }
}

function buildCsp(env: Record<string, string>, mode: string): string {
  const apiOrigin = originOf(env.VITE_API_BASE_URL);
  const wsOrigin = originOf(env.VITE_WS_URL, apiOrigin);
  const connect = new Set<string>(["'self'"]);
  // Only Vite `--mode production` is a prod CSP. Do not flip to prod CSP just because
  // VITE_API_BASE_URL is https (local `npm run dev` often points at the Render API).
  const isProd = mode === 'production';

  if (apiOrigin) {
    connect.add(apiOrigin);
  }
  if (wsOrigin) {
    connect.add(wsOrigin);
    // SockJS may upgrade from https → wss on the same host
    if (wsOrigin.startsWith('https://')) {
      connect.add(wsOrigin.replace(/^https:/, 'wss:'));
    }
    if (wsOrigin.startsWith('http://')) {
      connect.add(wsOrigin.replace(/^http:/, 'ws:'));
    }
  }

  if (isProd) {
    // Production meta CSP must include https/wss or the Render header ∩ meta intersection
    // collapses to 'self' only and sign-in fails with a network error.
    connect.add('https:');
    connect.add('wss:');
  } else {
    // Local API + Vite HMR websocket (ws://localhost:5173). Without these, the admin shell
    // fails to load in the browser even though the HTML response is 200.
    connect.add('http://127.0.0.1:8085');
    connect.add('http://localhost:8085');
    connect.add('ws://127.0.0.1:8085');
    connect.add('ws://localhost:8085');
    connect.add('ws:');
    connect.add('http:');
  }

  // Vite injects an inline react-refresh module in development; production uses hashed files only.
  const scriptSrc = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    `connect-src ${[...connect].join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function cspMetaPlugin(getEnv: () => Record<string, string>, mode: string): Plugin {
  return {
    name: 'palpeer-csp-meta',
    transformIndexHtml(html) {
      const csp = buildCsp(getEnv(), mode);
      const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
      if (html.includes('<!--csp-->')) {
        return html.replace('<!--csp-->', tag);
      }
      return html.replace('</head>', `    ${tag}\n  </head>`);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vite's loadEnv() lets process.env override .env files. Shells that ran Render deploy /
  // render-env.mjs often leave VITE_API_BASE_URL=https://palpeer-api... set, so local sign-in
  // calls the remote API (CORS → "Network error") instead of the Vite /api proxy to :8085.
  if (mode === 'development') {
    delete process.env.VITE_API_BASE_URL;
    delete process.env.VITE_WS_URL;
    delete process.env.VITE_APP_ENV;
  }

  const fileEnv = loadEnv(mode, process.cwd(), '');

  if (mode === 'development') {
    const localApi = fileEnv.VITE_API_BASE_URL || '/api/v1';
    const localWs = fileEnv.VITE_WS_URL || 'http://localhost:8085/ws';
    const localAppEnv = fileEnv.VITE_APP_ENV || 'development';
    process.env.VITE_API_BASE_URL = localApi;
    process.env.VITE_WS_URL = localWs;
    process.env.VITE_APP_ENV = localAppEnv;
    fileEnv.VITE_API_BASE_URL = localApi;
    fileEnv.VITE_WS_URL = localWs;
    fileEnv.VITE_APP_ENV = localAppEnv;
  }

  const processEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => typeof v === 'string') as [string, string][],
  );

  // Production builds: process env (Render) wins. Development: file/local defaults win (above).
  const env =
    mode === 'development'
      ? { ...processEnv, ...fileEnv }
      : { ...fileEnv, ...processEnv };
  const csp = buildCsp(env, mode);

  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': csp,
  };

  const previewSecurityHeaders = {
    ...securityHeaders,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  return {
    plugins: [react(), cspMetaPlugin(() => env, mode)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      headers: securityHeaders,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8085',
          changeOrigin: true,
          timeout: 180_000,
          proxyTimeout: 180_000,
        },
      },
    },
    preview: {
      headers: previewSecurityHeaders,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      clearMocks: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      pool: 'threads',
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      env: {
        VITE_USE_MOCK_API: 'true',
        VITE_APP_ENV: 'test',
        VITE_API_BASE_URL: 'http://localhost:8085/api/v1',
        VITE_WS_URL: 'http://localhost:8085/ws',
      },
    },
  };
});
