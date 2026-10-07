import { sessionManager } from '@/services/auth/session';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';
import { secureStorage } from '@/services/storage/secureStorage';
import { store } from '@/store';
import { installFetchMock } from '@/tests/fetchMock';

describe('store sign-out wiring', () => {
  beforeEach(async () => {
    await secureStorage.clearAll();
  });

  it('drops a queued link destination so the next account does not open it', async () => {
    installFetchMock({});
    pendingNavigation.set('/kyc');

    await sessionManager.signOut();

    expect(pendingNavigation.peek()).toBeNull();
    expect(store.getState().session.status).toBe('unauthenticated');
  });
});
