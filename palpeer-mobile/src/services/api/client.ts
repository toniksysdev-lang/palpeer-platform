import * as Crypto from 'expo-crypto';

import { appConfig, isApiConfigured } from '@/config/env';
import type { ApiEnvelope } from '@/types/api/common';
import { logger } from '@/utils/logger';

import { createAppError, errorFromResponse, type AppError } from './errors';
import { parseJson, stringifyJson } from './json';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** Multipart uploads pass FormData; JSON bodies are serialised losslessly. */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  accessToken?: string | null;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ApiResult<T> =
  { ok: true; data: T; message: string | null } | { ok: false; error: AppError };

export function newRequestId(): string {
  return Crypto.randomUUID();
}

export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = appConfig.apiBaseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${base}${normalizedPath}${params ? `?${params}` : ''}`;
}

export function parseEnvelope(text: string): ApiEnvelope<unknown> | null {
  if (!text) return null;
  try {
    const parsed = parseJson<unknown>(text);
    if (parsed && typeof parsed === 'object' && 'success' in parsed) {
      return parsed as ApiEnvelope<unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Single HTTP entry point. Unwraps the backend envelope, normalises errors and never throws:
 * callers always receive an `ApiResult`.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  if (!isApiConfigured()) {
    return { ok: false, error: createAppError('notConfigured') };
  }

  const requestId = newRequestId();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': requestId,
    ...options.headers,
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let body: string | FormData | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = stringifyJson(options.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? appConfig.requestTimeoutMs,
  );
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    const envelope = parseEnvelope(text);

    if (!response.ok) {
      const error = errorFromResponse(response.status, envelope, requestId);
      logger.warn('API request failed', {
        path,
        status: response.status,
        errorCode: error.code,
        requestId,
      });
      return { ok: false, error };
    }
    if (envelope && envelope.success === false) {
      return { ok: false, error: errorFromResponse(response.status, envelope, requestId) };
    }
    return {
      ok: true,
      data: (envelope?.data ?? undefined) as T,
      message: envelope?.message ?? null,
    };
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      return { ok: false, error: createAppError('timeout', { requestId }) };
    }
    logger.warn('API network error', { path, requestId, error });
    return { ok: false, error: createAppError('offline', { requestId }) };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
