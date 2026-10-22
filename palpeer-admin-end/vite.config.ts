import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
  plugins: [react()],
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
    headers: securityHeaders,
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
