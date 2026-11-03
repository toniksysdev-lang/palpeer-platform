import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  loadPersistedSession,
  loadRememberPreference,
  persistRotatedTokens,
  persistSession,
} from '@/features/auth/session';

const validTokens = {
  userId: 'u-1',
  accessToken: 'aaa.bbb.ccc',
  refreshToken: 'ddd.eee.fff',
  tokenType: 'Bearer' as const,
};

describe('session persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('always persists tokens in sessionStorage (even when remember email is on)', () => {
    persistSession(validTokens, true, { email: 'admin@palpeer.local' });

    expect(sessionStorage.getItem('palpeer.admin.accessToken')).toBe(validTokens.accessToken);
    expect(localStorage.getItem('palpeer.admin.accessToken')).toBeNull();
    expect(loadRememberPreference()).toBe(true);
    expect(localStorage.getItem('palpeer.admin.rememberEmail')).toBe('admin@palpeer.local');

    const loaded = loadPersistedSession();
    expect(loaded?.userId).toBe('u-1');
    expect(loaded?.remember).toBe(true);

    clearSession();
    expect(loadPersistedSession()).toBeNull();
    expect(loadRememberPreference()).toBe(true);
  });

  it('persists ephemeral sessions in sessionStorage only', () => {
    persistSession(validTokens, false);

    expect(sessionStorage.getItem('palpeer.admin.accessToken')).toBe(validTokens.accessToken);
    expect(localStorage.getItem('palpeer.admin.accessToken')).toBeNull();
    expect(loadRememberPreference()).toBe(false);

    const loaded = loadPersistedSession();
    expect(loaded?.remember).toBe(false);
    expect(loaded?.accessToken).toBe(validTokens.accessToken);
  });

  it('purges legacy localStorage tokens on load', () => {
    localStorage.setItem('palpeer.admin.remember', 'true');
    localStorage.setItem('palpeer.admin.accessToken', validTokens.accessToken);
    localStorage.setItem('palpeer.admin.refreshToken', validTokens.refreshToken);
    localStorage.setItem('palpeer.admin.userId', validTokens.userId);

    expect(loadPersistedSession()).toBeNull();
    expect(localStorage.getItem('palpeer.admin.accessToken')).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('rotates tokens into sessionStorage', () => {
    persistSession(validTokens, true);
    persistRotatedTokens({
      ...validTokens,
      accessToken: 'mmm.nnn.ooo',
      refreshToken: 'ppp.qqq.rrr',
    });

    expect(sessionStorage.getItem('palpeer.admin.accessToken')).toBe('mmm.nnn.ooo');
    expect(localStorage.getItem('palpeer.admin.accessToken')).toBeNull();
  });
});
