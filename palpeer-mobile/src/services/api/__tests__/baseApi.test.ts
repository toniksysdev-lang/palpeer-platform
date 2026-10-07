import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { createStore } from '@/store';
import { installFetchMock, ok } from '@/tests/fetchMock';

import { baseApi } from '../baseApi';

const testApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    probe: build.query<{ value: string }, void>({ query: () => ({ path: '/probe' }) }),
    remove: build.mutation<void, void>({ query: () => ({ path: '/probe', method: 'DELETE' }) }),
  }),
});

const tokens = (n: number) => ({
  userId: 'u-1',
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  tokenType: 'Bearer' as const,
});

describe('baseApi re-authentication', () => {
  beforeEach(async () => {
    await secureStorage.clearAll();
  });

  it('refreshes once on an expired access token (403, empty body) and retries the request', async () => {
    await sessionManager.start(tokens(0), 'ada@example.com');
    let probeCalls = 0;
    const { calls } = installFetchMock({
      'GET /probe': ({ headers }) => {
        probeCalls += 1;
        return headers.Authorization === 'Bearer access-1'
          ? ok({ value: 'fresh' })
          : { status: 403 };
      },
      'POST /auth/refresh': ok(tokens(1)),
    });

    const store = createStore();
    const result = await store.dispatch(testApi.endpoints.probe.initiate(undefined));

    expect(result.data).toEqual({ value: 'fresh' });
    expect(probeCalls).toBe(2);
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
    expect(calls.find((c) => c.path === '/auth/refresh')?.body).toEqual({
      refreshToken: 'refresh-0',
    });
    expect((await secureStorage.loadSession())?.refreshToken).toBe('refresh-1');
  });

  it('does not refresh on a real authorization failure (403 with envelope)', async () => {
    await sessionManager.start(tokens(0), 'ada@example.com');
    const { calls } = installFetchMock({
      'GET /probe': {
        status: 403,
        body: {
          success: false,
          message: 'Access denied',
          error: { code: 'ACCESS_DENIED' },
          timestamp: '',
        },
      },
    });

    const store = createStore();
    const result = await store.dispatch(testApi.endpoints.probe.initiate(undefined));

    expect(result.error).toMatchObject({ kind: 'forbidden', code: 'ACCESS_DENIED' });
    expect(calls.some((c) => c.path === '/auth/refresh')).toBe(false);
  });

  it('resolves a mutation whose response carries no data', async () => {
    await sessionManager.start(tokens(0), 'ada@example.com');
    installFetchMock({ 'DELETE /probe': ok() });

    const store = createStore();
    const result = await store.dispatch(testApi.endpoints.remove.initiate(undefined));

    expect('error' in result).toBe(false);
  });

  it('ends the session when refresh is rejected', async () => {
    await sessionManager.start(tokens(0), 'ada@example.com');
    installFetchMock({
      'GET /probe': { status: 403 },
      'POST /auth/refresh': {
        status: 401,
        body: { success: false, error: { code: 'INVALID_REFRESH_TOKEN' }, timestamp: '' },
      },
    });

    const store = createStore();
    const result = await store.dispatch(testApi.endpoints.probe.initiate(undefined));

    expect(result.error).toMatchObject({ kind: 'unauthorized' });
    expect(sessionManager.getAccessToken()).toBeNull();
    expect(await secureStorage.loadSession()).toBeNull();
  });
});
