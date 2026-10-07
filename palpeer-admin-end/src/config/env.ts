import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().optional(),
  VITE_WS_URL: z.string().optional(),
  VITE_APP_ENV: z.string().optional(),
  VITE_USE_MOCK_API: z.string().optional(),
});

const parsed = envSchema.parse(import.meta.env);

const appEnv =
  parsed.VITE_APP_ENV === 'staging' ||
  parsed.VITE_APP_ENV === 'production' ||
  parsed.VITE_APP_ENV === 'test' ||
  parsed.VITE_APP_ENV === 'development'
    ? parsed.VITE_APP_ENV
    : 'development';

/** Production builds must never enable mock mode. */
const useMockApi = import.meta.env.PROD ? false : parsed.VITE_USE_MOCK_API === 'true';

function resolveApiBaseUrl(): string {
  const raw = (parsed.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api/v1' : 'http://localhost:8085/api/v1')).trim();

  // Same-origin relative base (recommended for Vite proxy) — avoids localhost vs 127.0.0.1 CORS breaks.
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    if (import.meta.env.PROD) {
      throw new Error('Production builds require an absolute VITE_API_BASE_URL.');
    }
    return raw.replace(/\/$/, '') || '/api/v1';
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute URL or a same-origin path like /api/v1.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use http or https.');
  }

  // Production admin traffic must not call plaintext APIs (except local loopback for rare previews).
  if (import.meta.env.PROD && url.protocol !== 'https:') {
    const host = url.hostname;
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (!loopback) {
      throw new Error('Production builds require https:// for VITE_API_BASE_URL.');
    }
  }

  return raw.replace(/\/$/, '');
}

function resolveWsUrl(): string {
  const raw = (parsed.VITE_WS_URL || 'http://localhost:8085/ws').trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new Error('invalid');
    }
    if (import.meta.env.PROD && (url.protocol === 'http:' || url.protocol === 'ws:')) {
      const host = url.hostname;
      const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
      if (!loopback) {
        throw new Error('Production builds require wss:// or https:// for VITE_WS_URL.');
      }
    }
  } catch {
    throw new Error('VITE_WS_URL must be a valid absolute URL.');
  }
  return raw.replace(/\/$/, '');
}

export const appConfig = {
  apiBaseUrl: resolveApiBaseUrl(),
  wsUrl: resolveWsUrl(),
  appEnv,
  useMockApi,
  isProduction: import.meta.env.PROD,
} as const;
