import { sessionManager } from '@/services/auth/session';
import { securityCommands } from '@/services/security/securityCommands';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';

const TOKENS = {
  userId: 'u-1',
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
};

describe('authorizedRequest with security commands', () => {
  beforeEach(async () => {
    await secureStorage.clearAll();
    await sessionManager.start(
      { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
      'ada@example.com',
    );
  });

  it('does not refresh and retry on a wrong PIN, so one attempt counts once', async () => {
    const { calls } = installFetchMock({
      'POST /security/pin/verify': fail(401, 'PIN_INVALID', 'Invalid PIN'),
      'POST /auth/refresh': ok(TOKENS),
    });

    const result = await securityCommands.verifyPin({ pin: '1234' });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('PIN_INVALID');
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /security/pin/verify',
    ]);
  });

  it('does not retry a wrong security answer', async () => {
    const { calls } = installFetchMock({
      'POST /security/pin/reset': fail(401, 'SECURITY_ANSWER_INVALID'),
      'POST /auth/refresh': ok(TOKENS),
    });

    await securityCommands.resetPin({
      answers: [{ questionKey: 'FIRST_PET', answer: 'rex' }],
      newPin: '5678',
    });

    expect(calls).toHaveLength(1);
  });

  it('refreshes once and retries when the session expired (403 with no body)', async () => {
    const { calls } = installFetchMock({
      'POST /security/pin/verify': [{ status: 403 }, ok()],
      'POST /auth/refresh': ok(TOKENS),
    });

    const result = await securityCommands.verifyPin({ pin: '1234' });

    expect(result.ok).toBe(true);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /security/pin/verify',
      'POST /auth/refresh',
      'POST /security/pin/verify',
    ]);
    expect(calls[2]?.headers.Authorization).toBe('Bearer access-1');
  });
});
