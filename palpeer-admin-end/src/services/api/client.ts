import { appConfig } from '@/config/env';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  persistRotatedTokens,
} from '@/features/auth/session';
import { isJwtExpired } from '@/lib/jwt';
import { ApiClientError, type ApiResponse, type AuthTokens } from '@/types/api';

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Skip refresh retry (used by refresh itself). */
  skipRefresh?: boolean;
};

let refreshPromise: Promise<AuthTokens | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

function buildUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || /[:\\]/.test(path.split('?')[0] ?? path)) {
    throw new ApiClientError(400, 'INVALID_PATH', 'Invalid API path.');
  }
  const base = appConfig.apiBaseUrl.replace(/\/$/, '');
  return `${base}${path}`;
}

function networkErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The request was cancelled or timed out. Try again or increase the timeout.';
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return 'The request timed out before the server responded.';
    }
  }
  return 'Network error. Check your connection and try again.';
}

function mapHumanMessage(status: number, code: string, fallback: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password.';
    case 'USER_DISABLED':
      return 'This account is disabled.';
    case 'EMAIL_NOT_VERIFIED':
      return 'Verify your email before signing in.';
    case 'INVALID_REFRESH_TOKEN':
    case 'REFRESH_TOKEN_EXPIRED':
      return 'Your session has expired. Please sign in again.';
    case 'ACCESS_DENIED':
      return 'You do not have permission to perform this action.';
    // Legacy reject-concurrent login (replaced by session takeover). Keep copy for old APIs.
    case 'SESSION_ALREADY_ACTIVE':
      return 'This account already has an active session. Sign in again to take over that session.';
    default:
      break;
  }

  switch (status) {
    case 400:
      return fallback && fallback !== 'Request failed.' ? fallback : 'The request was invalid.';
    case 401:
      return fallback && fallback !== 'Request failed.'
        ? fallback
        : 'Authentication is required or the session is no longer valid.';
    case 403:
      return fallback && fallback !== 'Request failed.'
        ? fallback
        : 'You do not have permission to access this resource.';
    case 404:
      return fallback && fallback !== 'Request failed.'
        ? fallback
        : 'The requested resource was not found.';
    case 409:
      return fallback && fallback !== 'Request failed.'
        ? fallback
        : 'This action conflicts with the current state.';
    case 422:
      return fallback && fallback !== 'Request failed.'
        ? fallback
        : 'The server rejected the submitted data.';
    case 429:
      return 'Too many requests. Please wait and try again.';
    case 500:
    case 502:
    case 503:
      // Vite's API proxy returns an empty body when the backend on :8085 is down.
      // Do not treat a real JSON "Internal server error" body as an unreachable API.
      if (!fallback || fallback === 'Request failed.') {
        return 'Cannot reach the API server. Check that the backend is running on port 8085.';
      }
      return fallback || 'A server error occurred. Please try again later.';
    default:
      return fallback || 'Something went wrong.';
  }
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  if (!text) {
    return { success: response.ok };
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(response.status, 'INVALID_RESPONSE', 'Unexpected server response.');
  }
}

async function refreshAccessToken(): Promise<AuthTokens | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      try {
        const response = await fetch(buildUrl('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
          credentials: 'omit',
          cache: 'no-store',
        });
        const payload = await parseResponse<AuthTokens>(response);
        if (!response.ok || !payload.success || !payload.data) {
          return null;
        }
        persistRotatedTokens(payload.data);
        return payload.data;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function resolveAccessToken(skipRefresh?: boolean): Promise<string | null> {
  let accessToken = getAccessToken();
  if (accessToken && isJwtExpired(accessToken) && !skipRefresh) {
    const rotated = await refreshAccessToken();
    accessToken = rotated?.accessToken ?? null;
    if (!accessToken) {
      clearSession();
      onSessionExpired?.();
      throw new ApiClientError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }
  }
  return accessToken;
}

export type BinaryResponse = {
  blob: Blob;
  contentType: string;
  filename: string | null;
};

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return null;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

export async function apiBinaryRequest(
  path: string,
  options: { signal?: AbortSignal; accept?: string; skipRefresh?: boolean } = {},
): Promise<BinaryResponse> {
  const headers: Record<string, string> = { Accept: options.accept ?? '*/*' };
  const accessToken = await resolveAccessToken(options.skipRefresh);
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: 'GET',
      headers,
      signal: options.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiClientError(0, 'NETWORK_ERROR', networkErrorMessage(error));
  }

  if (response.status === 401 && !options.skipRefresh) {
    const rotated = await refreshAccessToken();
    if (rotated?.accessToken) {
      return apiBinaryRequest(path, { ...options, skipRefresh: true });
    }
    clearSession();
    onSessionExpired?.();
    throw new ApiClientError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
    const code = payload?.error?.code ?? `HTTP_${response.status}`;
    const fallback = payload?.message || payload?.error?.detail || 'Request failed.';
    throw new ApiClientError(response.status, code, mapHumanMessage(response.status, code, fallback));
  }

  const blob = await response.blob();
  return {
    blob,
    contentType: response.headers.get('Content-Type') ?? blob.type ?? 'application/octet-stream',
    filename: filenameFromDisposition(response.headers.get('Content-Disposition')),
  };
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...options.headers,
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false) {
    const accessToken = await resolveAccessToken(options.skipRefresh);
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      // Bearer JWT auth — never send cookies (reduces CSRF surface).
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiClientError(0, 'NETWORK_ERROR', networkErrorMessage(error));
  }

  if (response.status === 401 && options.auth !== false && !options.skipRefresh) {
    const rotated = await refreshAccessToken();
    if (rotated?.accessToken) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    clearSession();
    onSessionExpired?.();
    throw new ApiClientError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  const payload = await parseResponse<T>(response);
  if (!response.ok || payload.success === false) {
    const code = payload.error?.code ?? `HTTP_${response.status}`;
    const detail = payload.error?.detail ?? undefined;
    const message = mapHumanMessage(
      response.status,
      code,
      payload.message || detail || 'Request failed.',
    );
    throw new ApiClientError(response.status, code, message, detail);
  }

  return payload.data as T;
}
