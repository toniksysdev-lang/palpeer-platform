import { apiRequest } from '@/services/api/client';
import type { AppError } from '@/services/api/errors';
import { removeThisDeviceWithToken } from '@/services/biometrics/deviceRegistration';
import { removePushRegistrationWithToken } from '@/services/push/pushNotifications';
import { secureStorage } from '@/services/storage/secureStorage';
import type { SignOutReason } from '@/store/slices/sessionSlice';
import type { AuthTokensResponse, LogoutRequest, RefreshTokenRequest } from '@/types/api/auth';
import { logger } from '@/utils/logger';

type SessionListener = {
  onStarted: (session: { userId: string; email: string | null }) => void;
  onExpired: () => void;
  onSignedOut: (reason?: SignOutReason) => void;
};

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let listener: SessionListener | null = null;

export type RefreshOutcome =
  | { status: 'refreshed'; accessToken: string }
  | { status: 'rejected'; error: AppError }
  | { status: 'unreachable'; error: AppError }
  | { status: 'noSession' };

/** Refresh failures that mean the stored refresh token can never succeed again. */
function isRejection(error: AppError): boolean {
  return error.kind === 'unauthorized' || error.kind === 'forbidden' || error.kind === 'validation';
}

async function performRefresh(): Promise<RefreshOutcome> {
  const stored = await secureStorage.loadSession();
  if (!stored) return { status: 'noSession' };

  const body: RefreshTokenRequest = { refreshToken: stored.refreshToken };
  const result = await apiRequest<AuthTokensResponse>('/auth/refresh', { method: 'POST', body });
  if (!result.ok) {
    return isRejection(result.error)
      ? { status: 'rejected', error: result.error }
      : { status: 'unreachable', error: result.error };
  }

  accessToken = result.data.accessToken;
  await secureStorage.updateRefreshToken(result.data.refreshToken);
  return { status: 'refreshed', accessToken: result.data.accessToken };
}

export const sessionManager = {
  setListener(next: SessionListener) {
    listener = next;
  },

  getAccessToken(): string | null {
    return accessToken;
  },

  async start(tokens: AuthTokensResponse, email: string | null): Promise<void> {
    accessToken = tokens.accessToken;
    await secureStorage.saveSession({
      refreshToken: tokens.refreshToken,
      userId: tokens.userId,
      email,
    });
    listener?.onStarted({ userId: tokens.userId, email });
  },

  /**
   * Single-flight refresh. Concurrent callers share one POST /auth/refresh because the backend
   * rotates refresh tokens and a second call with the old token would be rejected.
   * Returns the new access token, or null when the session can't be refreshed right now.
   */
  refreshAccessToken(): Promise<string | null> {
    if (!refreshInFlight) {
      refreshInFlight = performRefresh()
        .then(async (outcome) => {
          if (outcome.status === 'refreshed') return outcome.accessToken;
          if (outcome.status === 'rejected' || outcome.status === 'noSession') {
            await sessionManager.expire();
          }
          return null;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }
    return refreshInFlight;
  },

  /**
   * Cold-start restore. A rejected refresh clears the session; an unreachable server keeps the
   * stored session so the user lands in the app with the offline banner and retries later.
   */
  async restore(): Promise<'authenticated' | 'unauthenticated'> {
    const stored = await secureStorage.loadSession();
    if (!stored) return 'unauthenticated';

    const outcome = await performRefresh();
    if (outcome.status === 'refreshed' || outcome.status === 'unreachable') {
      if (outcome.status === 'unreachable') {
        logger.warn('Session restore deferred: server unreachable', { kind: outcome.error.kind });
      }
      listener?.onStarted({ userId: stored.userId, email: stored.email });
      return 'authenticated';
    }
    accessToken = null;
    await secureStorage.clearSession();
    return 'unauthenticated';
  },

  async expire(): Promise<void> {
    accessToken = null;
    await secureStorage.clearSession();
    listener?.onExpired();
  },

  /**
   * `reason` is set when the backend already revoked this session's refresh token (password
   * change, "sign out everywhere"); the logout call is still made and is harmless.
   */
  async signOut(reason?: SignOutReason): Promise<void> {
    const stored = await secureStorage.loadSession();
    if (stored && (await secureStorage.getBiometricUserId())) {
      await removeThisDeviceWithToken(accessToken).catch((error: unknown) =>
        logger.warn('Device removal on sign-out failed', { error }),
      );
    }
    await removePushRegistrationWithToken(accessToken).catch((error: unknown) =>
      logger.warn('Push registration removal on sign-out failed', { error }),
    );
    if (stored) {
      const body: LogoutRequest = { refreshToken: stored.refreshToken };
      const result = await apiRequest<void>('/auth/logout', { method: 'POST', body });
      if (!result.ok) {
        logger.warn('Logout request failed; clearing local session anyway', {
          kind: result.error.kind,
        });
      }
    }
    accessToken = null;
    await secureStorage.clearSession();
    listener?.onSignedOut(reason);
  },
};
