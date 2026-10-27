import { getOrCreateAdminDeviceId } from '@/features/auth/session';
import { apiRequest } from '@/services/api/client';
import type { AdminMe } from '@/types/admin';
import type { AuthTokens } from '@/types/api';

export type LoginInput = {
  email: string;
  password: string;
  /** When true, backend issues a longer-lived refresh token. */
  rememberMe?: boolean;
};

export async function loginRequest(input: LoginInput): Promise<AuthTokens> {
  return apiRequest<AuthTokens>('/auth/login', {
    method: 'POST',
    body: {
      email: input.email.trim(),
      password: input.password,
      rememberMe: Boolean(input.rememberMe),
      // Bind admin console sessions to this browser so login can replace prior tokens.
      deviceIdentifier: getOrCreateAdminDeviceId(),
      deviceName: 'Palpeer Admin',
      platform: 'web',
    },
    auth: false,
  });
}

export async function verifyMfaRequest(input: { mfaToken: string; code: string }): Promise<AuthTokens> {
  return apiRequest<AuthTokens>('/auth/mfa/verify', {
    method: 'POST',
    body: {
      mfaToken: input.mfaToken,
      code: input.code.trim(),
    },
    auth: false,
  });
}

export type AdminMfaStatus = {
  enabled: boolean;
  enabledAt?: string | null;
  recoveryCodesRemaining?: number;
  enrollmentRequired?: boolean;
};

export type AdminMfaSetup = {
  secret: string;
  otpauthUrl: string;
};

export type AdminMfaEnableResult = {
  enabled: boolean;
  enabledAt?: string | null;
  recoveryCodes?: string[];
  recoveryCodesRemaining?: number;
};

export async function fetchAdminMfaStatus(): Promise<AdminMfaStatus> {
  return apiRequest<AdminMfaStatus>('/admin/mfa');
}

export async function beginAdminMfaSetup(): Promise<AdminMfaSetup> {
  return apiRequest<AdminMfaSetup>('/admin/mfa/setup', { method: 'POST' });
}

export async function enableAdminMfa(code: string): Promise<AdminMfaEnableResult> {
  return apiRequest<AdminMfaEnableResult>('/admin/mfa/enable', {
    method: 'POST',
    body: { code: code.trim() },
  });
}

export async function disableAdminMfa(input: {
  password: string;
  code: string;
}): Promise<AdminMfaStatus> {
  return apiRequest<AdminMfaStatus>('/admin/mfa/disable', {
    method: 'POST',
    body: { password: input.password, code: input.code.trim() },
  });
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await apiRequest<null>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
    skipRefresh: true,
  });
}

export async function refreshRequest(refreshToken: string): Promise<AuthTokens> {
  return apiRequest<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
    skipRefresh: true,
  });
}

/**
 * Returns the current admin profile including role and permission codes.
 * Also serves as the admin-access probe (requires ROLE_ADMIN).
 */
export async function fetchAdminMe(): Promise<AdminMe> {
  return apiRequest<AdminMe>('/admin/me');
}

/**
 * Verifies the caller has ROLE_ADMIN by hitting a verified admin endpoint.
 * JWT does not embed authorities — server enrichment is authoritative.
 */
export async function verifyAdminAccess(): Promise<AdminMe> {
  return fetchAdminMe();
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest<null>('/auth/password-reset/request', {
    method: 'POST',
    body: { email: email.trim() },
    auth: false,
  });
}

export type AuthSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiRequest<null>('/auth/password/change', {
    method: 'POST',
    body: { currentPassword: input.currentPassword, newPassword: input.newPassword },
  });
}

export async function listAuthSessions(refreshToken?: string | null): Promise<AuthSession[]> {
  return apiRequest<AuthSession[]>('/auth/sessions', {
    headers: refreshToken ? { 'X-Refresh-Token': refreshToken } : undefined,
  });
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  await apiRequest<null>(`/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: 'POST',
  });
}

export async function revokeAllAuthSessions(): Promise<void> {
  await apiRequest<null>('/auth/sessions/revoke-all', { method: 'POST' });
}

export async function confirmPasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  await apiRequest<null>('/auth/password-reset/confirm', {
    method: 'POST',
    body: {
      email: input.email.trim(),
      code: input.code.trim(),
      newPassword: input.newPassword,
    },
    auth: false,
  });
}
