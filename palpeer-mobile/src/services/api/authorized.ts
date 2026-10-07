import { sessionManager } from '@/services/auth/session';

import { apiRequest, type ApiResult, type RequestOptions } from './client';
import { isSessionExpired } from './errors';

/**
 * Authenticated request with one token refresh on an expired session. Used by RTK Query and by
 * calls that must not go through RTK Query because their bodies are secrets (PINs, security
 * answers): RTK keeps mutation arguments in the Redux store.
 */
export async function authorizedRequest<T>(
  path: string,
  options: Omit<RequestOptions, 'accessToken'> = {},
): Promise<ApiResult<T>> {
  const first = await apiRequest<T>(path, {
    ...options,
    accessToken: sessionManager.getAccessToken(),
  });
  if (first.ok || !isSessionExpired(first.error)) return first;

  const refreshed = await sessionManager.refreshAccessToken();
  if (!refreshed) return first;
  return apiRequest<T>(path, { ...options, accessToken: refreshed });
}
