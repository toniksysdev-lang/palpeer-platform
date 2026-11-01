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

  it('persists and loads a remembered session from localStorage only', () => {
    persistSession(validTokens, true, { email: 'admin@palpeer.local' });

    expect(localStorage.getItem('palpeer.admin.accessToken')).toBe(validTokens.accessToken);
    expect(sessionStorage.getItem('palpeer.admin.accessToken')).toBeNull();
    expect(loadRememberPreference()).toBe(true);

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

  it('does not resurrect localStorage tokens when remember is off', () => {
    localStorage.setItem('palpeer.admin.remember', 'false');
    localStorage.setItem('palpeer.admin.accessToken', validTokens.accessToken);
    localStorage.setItem('palpeer.admin.refreshToken', validTokens.refreshToken);
    localStorage.setItem('palpeer.admin.userId', validTokens.userId);

    expect(loadPersistedSession()).toBeNull();
    expect(localStorage.getItem('palpeer.admin.accessToken')).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('does not fall back to sessionStorage when remember is on', () => {
    localStorage.setItem('palpeer.admin.remember', 'true');
    sessionStorage.setItem('palpeer.admin.accessToken', validTokens.accessToken);
    sessionStorage.setItem('palpeer.admin.refreshToken', validTokens.refreshToken);
    sessionStorage.setItem('palpeer.admin.userId', validTokens.userId);

    expect(loadPersistedSession()).toBeNull();
    expect(sessionStorage.getItem('palpeer.admin.accessToken')).toBeNull();
  });

  it('moves tokens when switching from remembered to ephemeral login', () => {
    persistSession(validTokens, true);
    persistSession(
      {
        ...validTokens,
        accessToken: 'ggg.hhh.iii',
        refreshToken: 'jjj.kkk.lll',
      },
      false,
    );

    expect(localStorage.getItem('palpeer.admin.accessToken')).toBeNull();
    expect(sessionStorage.getItem('palpeer.admin.accessToken')).toBe('ggg.hhh.iii');
    expect(loadPersistedSession()?.remember).toBe(false);
  });

  it('rotates tokens into the active remember store', () => {
    persistSession(validTokens, false);
    persistRotatedTokens({
      ...validTokens,
      accessToken: 'mmm.nnn.ooo',
      refreshToken: 'ppp.qqq.rrr',
    });

    expect(sessionStorage.getItem('palpeer.admin.accessToken')).toBe('mmm.nnn.ooo');
    expect(localStorage.getItem('palpeer.admin.accessToken')).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(() =>
      persistSession(
        {
          userId: 'u-1',
          accessToken: 'not-a-jwt',
          refreshToken: 'ddd.eee.fff',
          tokenType: 'Bearer',
        },
        false,
      ),
    ).toThrow(/malformed/i);
  });
});
