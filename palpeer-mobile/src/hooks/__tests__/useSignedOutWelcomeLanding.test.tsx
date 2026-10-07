import { renderHook, waitFor } from '@testing-library/react-native';

import { router, setPathname } from '@/tests/mocks/expoRouter';

import { useSignedOutWelcomeLanding } from '../useSignedOutWelcomeLanding';

jest.mock('expo-router', () => require('../../tests/mocks/expoRouter'));

describe('useSignedOutWelcomeLanding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPathname('/');
  });

  it('does not bounce away from Login after Welcome has already settled', async () => {
    setPathname('/welcome');
    const { rerender } = await renderHook(
      ({ path }: { path: string }) => {
        setPathname(path);
        return useSignedOutWelcomeLanding(true, false);
      },
      { initialProps: { path: '/welcome' } },
    );

    await waitFor(() => expect(router.replace).not.toHaveBeenCalled());

    rerender({ path: '/login' });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('preserves password-reset deep links', async () => {
    setPathname('/reset-password');
    await renderHook(() => useSignedOutWelcomeLanding(true, false));

    await waitFor(() => expect(router.replace).not.toHaveBeenCalled());
  });

  it('replaces to Welcome when signed out after cold start on Login', async () => {
    setPathname('/login');
    await renderHook(() => useSignedOutWelcomeLanding(true, false));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
  });
});
