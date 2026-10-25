import type { ApiEnvelope, ApiViolation } from '@/types/api/common';

export type AppErrorKind =
  | 'offline'
  | 'timeout'
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'unprocessable'
  | 'rateLimited'
  | 'server'
  | 'serviceUnavailable'
  | 'notConfigured'
  | 'unknown';

export type AppError = {
  kind: AppErrorKind;
  status: number | null;
  code: string | null;
  message: string;
  fieldErrors: Record<string, string>;
  requestId: string | null;
};

const FALLBACK_MESSAGES: Record<AppErrorKind, string> = {
  offline: "You're offline. Check your connection and try again.",
  timeout: 'The request took too long. Please try again.',
  validation: 'Some details need your attention.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have access to this.",
  notFound: "We couldn't find what you were looking for.",
  conflict: 'This action conflicts with the current state. Refresh and try again.',
  unprocessable: "This action can't be completed right now.",
  rateLimited: 'Too many attempts. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again.',
  serviceUnavailable: 'This service is temporarily unavailable.',
  notConfigured: 'The app is not connected to a server yet.',
  unknown: 'Something went wrong. Please try again.',
};

export function kindForStatus(status: number): AppErrorKind {
  if (status === 400) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 422) return 'unprocessable';
  if (status === 429) return 'rateLimited';
  if (status === 503) return 'serviceUnavailable';
  if (status >= 500) return 'server';
  return 'unknown';
}

function toFieldErrors(violations: ApiViolation[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const violation of violations ?? []) {
    if (!out[violation.field]) {
      out[violation.field] = violation.message;
    }
  }
  return out;
}

export function createAppError(
  kind: AppErrorKind,
  overrides: Partial<Omit<AppError, 'kind'>> = {},
): AppError {
  return {
    kind,
    status: overrides.status ?? null,
    code: overrides.code ?? null,
    message: overrides.message ?? FALLBACK_MESSAGES[kind],
    fieldErrors: overrides.fieldErrors ?? {},
    requestId: overrides.requestId ?? null,
  };
}

/**
 * Normalises a non-2xx response. The backend returns 403 with an empty body (no envelope) when the
 * access token is missing or expired on a protected route; that case is reported as `unauthorized`
 * so authenticated callers can refresh. Public screens should treat it as "not available", not a
 * signed-in session expiry.
 */
export function errorFromResponse(
  status: number,
  envelope: ApiEnvelope<unknown> | null,
  requestId: string | null,
): AppError {
  if (status === 403 && !envelope) {
    return createAppError('unauthorized', { status, requestId });
  }
  const kind = kindForStatus(status);
  const code = envelope?.error?.code ?? null;
  // Keep business-error copy on 5xx (e.g. 502 KUDA_NAME_ENQUIRY_FAILED). Hide only opaque
  // INTERNAL_ERROR / uncoded 500 bodies so stack traces never reach the UI.
  const hasBusinessCode = Boolean(code) && code !== 'INTERNAL_ERROR';
  const message =
    kind === 'server' && !hasBusinessCode
      ? FALLBACK_MESSAGES.server
      : envelope?.message || FALLBACK_MESSAGES[kind];
  return createAppError(kind, {
    status,
    code,
    message,
    fieldErrors: toFieldErrors(envelope?.error?.violations),
    requestId,
  });
}

/** User-facing copy for errors on screens that do not require a session. */
export function publicApiErrorMessage(error: AppError): string {
  if (error.kind === 'unauthorized' || error.kind === 'forbidden') {
    return "Rates aren't available right now. Please try again in a moment.";
  }
  return error.message;
}

/**
 * True only for an expired/missing access token. A 401 that carries a business code
 * (`PIN_INVALID`, `SECURITY_ANSWER_INVALID`) is a wrong secret, and refreshing and retrying it
 * would spend a second attempt against the PIN lockout.
 */
export function isSessionExpired(error: AppError): boolean {
  return error.kind === 'unauthorized' && !error.code;
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'message' in value &&
    'fieldErrors' in value
  );
}

export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  return createAppError('unknown');
}
