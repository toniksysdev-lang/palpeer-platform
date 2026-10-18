import { Platform } from 'react-native';

import { isApiConfigured } from '@/config/env';
import { sessionManager } from '@/services/auth/session';
import { logger } from '@/utils/logger';

import { buildUrl, newRequestId, parseEnvelope, type ApiResult } from './client';
import { createAppError, errorFromResponse, isSessionExpired } from './errors';

/** A local file ready to send as a multipart part (React Native FormData file shape). */
export type UploadFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export type UploadOptions = {
  /** Plain text parts sent before the file. */
  fields?: Record<string, string>;
  file: UploadFile;
  fileField?: string;
  /** 0–1. Only called when the platform reports a total size. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/** Large files on mobile data need longer than JSON calls. */
const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Native FormData accepts `{ uri, name, type }`. On web that becomes a useless
 * "[object Object]" part, so Spring never sees `file` and returns 500.
 * Resolve the URI to a real Blob/File for browser uploads.
 */
async function toMultipartFile(file: UploadFile): Promise<Blob | { uri: string; name: string; type: string }> {
  if (Platform.OS !== 'web') {
    return { uri: file.uri, name: file.name, type: file.mimeType };
  }

  const response = await fetch(file.uri);
  if (!response.ok) {
    throw new Error(`Failed to read upload file (${response.status})`);
  }
  const blob = await response.blob();
  const type = file.mimeType || blob.type || 'application/octet-stream';
  if (typeof File !== 'undefined') {
    return new File([blob], file.name, { type });
  }
  return blob;
}

async function buildForm({ fields, file, fileField = 'file' }: UploadOptions): Promise<FormData> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) {
    form.append(key, value);
  }
  const part = await toMultipartFile(file);
  form.append(fileField, part as Blob);
  return form;
}

function send<T>(
  path: string,
  options: UploadOptions,
  accessToken: string | null,
): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    const requestId = newRequestId();
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (result: ApiResult<T>) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => {
      xhr.abort();
      finish({
        ok: false,
        error: createAppError('unknown', { message: 'Upload cancelled.', requestId }),
      });
    };

    xhr.open('POST', buildUrl(path));
    xhr.timeout = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Request-Id', requestId);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    if (options.onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          options.onProgress?.(Math.min(1, event.loaded / event.total));
        }
      };
    }

    xhr.onload = () => {
      const envelope = parseEnvelope(xhr.responseText ?? '');
      const ok = xhr.status >= 200 && xhr.status < 300 && envelope?.success !== false;
      if (!ok) {
        const error = errorFromResponse(xhr.status, envelope, requestId);
        logger.warn('Upload failed', {
          path,
          status: xhr.status,
          errorCode: error.code,
          requestId,
        });
        finish({ ok: false, error });
        return;
      }
      options.onProgress?.(1);
      finish({ ok: true, data: envelope?.data as T, message: envelope?.message ?? null });
    };
    xhr.onerror = () => {
      logger.warn('Upload network error', { path, requestId });
      finish({ ok: false, error: createAppError('offline', { requestId }) });
    };
    xhr.ontimeout = () => finish({ ok: false, error: createAppError('timeout', { requestId }) });

    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    options.signal?.addEventListener('abort', onAbort);

    buildForm(options)
      .then((form) => {
        if (settled || options.signal?.aborted) {
          onAbort();
          return;
        }
        xhr.send(form);
      })
      .catch((error: unknown) => {
        logger.warn('Upload form build failed', { path, requestId, error });
        finish({
          ok: false,
          error: createAppError('unknown', {
            message: "We couldn't read that photo for upload. Please try another one.",
            requestId,
          }),
        });
      });
  });
}

/**
 * Authenticated multipart POST with upload progress. Mirrors `apiRequest` semantics: never throws,
 * unwraps the envelope, and refreshes the access token once on an expired-session response.
 */
export async function uploadMultipart<T>(
  path: string,
  options: UploadOptions,
): Promise<ApiResult<T>> {
  if (!isApiConfigured()) {
    return { ok: false, error: createAppError('notConfigured') };
  }

  const first = await send<T>(path, options, sessionManager.getAccessToken());
  if (first.ok || !isSessionExpired(first.error)) return first;

  const refreshed = await sessionManager.refreshAccessToken();
  if (!refreshed) return first;
  options.onProgress?.(0);
  return send<T>(path, options, refreshed);
}
