import { appConfig, isSupportChatConfigured } from '@/config/env';
import { createAppError, kindForStatus, type AppError } from '@/services/api/errors';
import { parseJson, stringifyJson } from '@/services/api/json';
import { logger } from '@/utils/logger';

export type SupportChatResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

type SupportRequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function buildUrl(path: string): string {
  const base = appConfig.supportChatApiBaseUrl.replace(/\/+$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

/**
 * HTTP client for the Support-Ticketing AI / live-chat API
 * (`https://app.palpeer.com.ng/api`). Separate from the main PALPEER `api/v1` client.
 */
export async function supportChatRequest<T>(
  path: string,
  options: SupportRequestOptions = {},
): Promise<SupportChatResult<T>> {
  if (!isSupportChatConfigured()) {
    return { ok: false, error: createAppError('notConfigured') };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? appConfig.requestTimeoutMs,
  );
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(buildUrl(path), {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: options.body === undefined ? undefined : stringifyJson(options.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = parseJson(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        data && typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message: unknown }).message)
          : `Support chat request failed (${response.status})`;
      return {
        ok: false,
        error: createAppError(kindForStatus(response.status), {
          status: response.status,
          message,
          code: 'SUPPORT_CHAT_ERROR',
        }),
      };
    }

    return { ok: true, data: data as T };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: createAppError('timeout') };
    }
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn('supportChatRequest failed', { path, url: buildUrl(path), detail, error });
    // Browsers report CORS failures as generic "Failed to fetch" / "Network request failed".
    if (/failed to fetch|network request failed|load failed/i.test(detail)) {
      return {
        ok: false,
        error: createAppError('serviceUnavailable', {
          message:
            "Couldn't reach live chat. If you're on web, restart Expo (Metro proxy) and try again.",
          code: 'SUPPORT_CHAT_NETWORK',
        }),
      };
    }
    return {
      ok: false,
      error: createAppError('offline', { code: 'SUPPORT_CHAT_NETWORK' }),
    };
  } finally {
    clearTimeout(timeout);
  }
}
