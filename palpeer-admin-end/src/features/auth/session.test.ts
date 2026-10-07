import { describe, expect, it } from 'vitest';
import { clearSession, loadPersistedSession, persistSession } from '@/features/auth/session';

describe('session persistence', () => {
  it('persists and loads a remembered session', () => {
    persistSession(
      {
        userId: 'u-1',
        accessToken: 'aaa.bbb.ccc',
        refreshToken: 'ddd.eee.fff',
        tokenType: 'Bearer',
      },
      true,
    );

    const loaded = loadPersistedSession();
    expect(loaded?.userId).toBe('u-1');
    expect(loaded?.remember).toBe(true);
    clearSession();
    expect(loadPersistedSession()).toBeNull();
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
