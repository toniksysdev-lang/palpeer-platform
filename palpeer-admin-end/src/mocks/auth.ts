import { KNOWN_PERMISSIONS } from '@/lib/permissions';
import { ApiClientError } from '@/types/api';
import type { AuthTokens } from '@/types/api';
import type { AuthSession, LoginInput } from '@/services/api/auth';

const MOCK_PASSWORDS = new Set(['admin', 'password', 'Admin123!']);

function encodeSegment(value: object): string {
  const json = JSON.stringify(value);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function mockLogin(input: LoginInput): AuthTokens {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    throw new ApiClientError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (!MOCK_PASSWORDS.has(input.password)) {
    throw new ApiClientError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = encodeSegment({ alg: 'none', typ: 'JWT' });
  const accessToken = [
    header,
    encodeSegment({
      sub: '00000000-0000-4000-8000-000000000001',
      email,
      token_type: 'access',
      exp: now + 60 * 60,
      iat: now,
    }),
    'mock',
  ].join('.');
  const refreshToken = [
    header,
    encodeSegment({
      sub: '00000000-0000-4000-8000-000000000001',
      token_type: 'refresh',
      exp: now + 60 * 60 * 24,
      iat: now,
    }),
    'mock',
  ].join('.');

  return {
    userId: '00000000-0000-4000-8000-000000000001',
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
  };
}

let mockSessions: AuthSession[] = [
  {
    id: 'sess-current',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 6).toISOString(),
    current: true,
  },
  {
    id: 'sess-laptop',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    current: false,
  },
  {
    id: 'sess-phone',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    current: false,
  },
];

export function mockChangePassword(input: { currentPassword: string; newPassword: string }): void {
  if (!MOCK_PASSWORDS.has(input.currentPassword)) {
    throw new ApiClientError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
  }
  if (input.newPassword.length < 8) {
    throw new ApiClientError(400, 'VALIDATION_FAILED', 'Password must be at least 8 characters.');
  }
  mockSessions = [];
}

export function mockListSessions(): AuthSession[] {
  return mockSessions.map((row) => ({ ...row }));
}

export function mockRevokeSession(sessionId: string): void {
  if (!mockSessions.some((row) => row.id === sessionId)) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Session not found.');
  }
  mockSessions = mockSessions.filter((row) => row.id !== sessionId);
}

export function mockRevokeAllSessions(): void {
  mockSessions = [];
}

export function mockAdminPermissions(): string[] {
  return [...KNOWN_PERMISSIONS, 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN'];
}
