import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function originOf(url: string | undefined, fallback: string): string {
  try {
    if (!url) return fallback;
    return new URL(url).origin;
  } catch {
    return fallback;
  }
}

function buildCsp(): string {
  const apiOrigin = originOf(
    process.env.VITE_API_BASE_URL,
    'http://127.0.0.1:8085',
  );
  const wsOrigin = originOf(process.env.VITE_WS_URL, apiOrigin);
  const connect = [
    "'self'",
    apiOrigin,
    wsOrigin,
    // Local Vite proxy / emulator fallbacks when env is unset
    'http://127.0.0.1:8085',
    'http://localhost:8085',
    'ws://127.0.0.1:8085',
    'ws://localhost:8085',
  ];
  const uniqueConnect = [...new Set(connect)].join(' ');

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    `connect-src ${uniqueConnect}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function cspMetaPlugin(): Plugin {
  return {
    name: 'palpeer-csp-meta',
    transformIndexHtml(html) {
      const csp = buildCsp();
      const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
      if (html.includes('<!--csp-->')) {
        return html.replace('<!--csp-->', tag);
      }
      return html.replace('</head>', `    ${tag}\n  </head>`);
    },
  };
}

const csp = buildCsp();

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

export default defineConfig({
  plugins: [react(), cspMetaPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Bind IPv4+IPv6 so http://localhost:5173 and http://127.0.0.1:5173 both work
    // (Node on Windows often listens only on ::1 for "localhost").
    host: true,
    port: 5173,
    strictPort: true,
    headers: securityHeaders,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8085',
        changeOrigin: true,
        // User delete and other heavy admin calls can exceed the default proxy idle timeout.
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
});
