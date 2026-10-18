import { secureStorage } from '@/services/storage/secureStorage';

import { sessionManager } from '../session';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

const tokens = (n: number) => ({
  success: true,
  data: {
    userId: 'u-1',
    accessToken: `access-${n}`,
    refreshToken: `refresh-${n}`,
    tokenType: 'Bearer',
  },
  timestamp: '',
});

describe('sessionManager', () => {
  const listener = { onStarted: jest.fn(), onExpired: jest.fn(), onSignedOut: jest.fn() };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    await secureStorage.clearAll();
    sessionManager.setListener(listener);
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  it('shares one refresh call between concurrent callers and rotates the refresh token', async () => {
    await secureStorage.saveSession({ refreshToken: 'refresh-0', userId: 'u-1', email: 'a@b.c' });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, tokens(1)));

    const results = await Promise.all([
      sessionManager.refreshAccessToken(),
      sessionManager.refreshAccessToken(),
      sessionManager.refreshAccessToken(),
    ]);

    expect(results).toEqual(['access-1', 'access-1', 'access-1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionManager.getAccessToken()).toBe('access-1');
    expect((await secureStorage.loadSession())?.refreshToken).toBe('refresh-1');
  });

  it('expires the session when the refresh token is rejected', async () => {
    await secureStorage.saveSession({ refreshToken: 'stale', userId: 'u-1', email: null });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { success: false, message: 'Invalid refresh token', timestamp: '' }),
    );

    await expect(sessionManager.refreshAccessToken()).resolves.toBeNull();
    expect(listener.onExpired).toHaveBeenCalledTimes(1);
    expect(await secureStorage.loadSession()).toBeNull();
  });

  it('keeps the stored session when the server is unreachable', async () => {
    await secureStorage.saveSession({ refreshToken: 'refresh-0', userId: 'u-1', email: null });
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(sessionManager.refreshAccessToken()).resolves.toBeNull();
    expect(listener.onExpired).not.toHaveBeenCalled();
    expect(await secureStorage.loadSession()).not.toBeNull();
  });

  it('restores optimistically while offline and clears on rejection', async () => {
    await secureStorage.saveSession({ refreshToken: 'refresh-0', userId: 'u-1', email: 'a@b.c' });
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(sessionManager.restore()).resolves.toBe('authenticated');
    expect(listener.onStarted).toHaveBeenCalledWith({ userId: 'u-1', email: 'a@b.c' });

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { success: false, timestamp: '' }));
    await expect(sessionManager.restore()).resolves.toBe('unauthenticated');
    expect(await secureStorage.loadSession()).toBeNull();
  });

  it('returns unauthenticated without a network call when nothing is stored', async () => {
    await expect(sessionManager.restore()).resolves.toBe('unauthenticated');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears local state on sign-out even if the logout call fails', async () => {
    await secureStorage.saveSession({ refreshToken: 'refresh-0', userId: 'u-1', email: null });
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await sessionManager.signOut();
    expect(listener.onSignedOut).toHaveBeenCalledTimes(1);
    expect(sessionManager.getAccessToken()).toBeNull();
    expect(await secureStorage.loadSession()).toBeNull();
  });

  it('dismisses to login without clearing the parked biometric session', async () => {
    await sessionManager.start(
      { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
      'ada@example.com',
    );
    await secureStorage.setBiometricUserId('u-1');

    await sessionManager.dismissToLogin();

    expect(listener.onSignedOut).toHaveBeenCalledTimes(1);
    expect(sessionManager.getAccessToken()).toBeNull();
    expect(await secureStorage.loadSession()).toEqual({
      refreshToken: 'refresh-0',
      userId: 'u-1',
      email: 'ada@example.com',
    });
    expect(await secureStorage.getBiometricUserId()).toBe('u-1');
  });
});
