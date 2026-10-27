import { defineConfig, loadEnv, type Plugin } from 'vitest/config';
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
  const isProd =
    mode === 'production' ||
    env.VITE_APP_ENV === 'production' ||
    (!!apiOrigin && apiOrigin.startsWith('https://'));

  if (apiOrigin) {
    connect.add(apiOrigin);
  } else if (!isProd) {
    // Local Vite defaults when env is unset
    connect.add('http://127.0.0.1:8085');
    connect.add('http://localhost:8085');
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
  } else if (!isProd) {
    connect.add('ws://127.0.0.1:8085');
    connect.add('ws://localhost:8085');
  }

  // Production meta CSP must include https/wss or the Render header ∩ meta intersection
  // collapses to 'self' only and sign-in fails with a network error.
  if (isProd) {
    connect.add('https:');
    connect.add('wss:');
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
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
  // Load .env / .env.production.local so CSP includes the real API origin on Render builds.
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => typeof v === 'string') as [string, string][],
    ),
  };
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
