import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { sessionStarted } from '@/store/slices/sessionSlice';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { ProfileScreen } from '../ProfileScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const emptyProfile = {
  id: 'p-1',
  userId: 'u-1',
  firstName: null,
  lastName: null,
  dateOfBirth: null,
  countryOfResidence: null,
  stateTerritory: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  postalCode: null,
  sourceOfIncome: null,
  monthlyTransactionEstimate: null,
  complete: false,
};

const KYC = {
  'GET /kyc/status': ok({
    caseId: null,
    userId: 'u-1',
    status: 'NOT_STARTED',
    rejectionReason: null,
    createdAt: null,
    updatedAt: null,
  }),
};

describe('ProfileScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await secureStorage.clearAll();
    await sessionManager.start(
      { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
      'ada@example.com',
    );
  });

  it('creates the profile once when none exists', async () => {
    const { calls } = installFetchMock({
      ...KYC,
      'GET /profiles/me': [fail(404, 'NOT_FOUND', 'Profile not found'), ok(emptyProfile)],
      'POST /profiles': ok(emptyProfile),
    });
    const { store } = await renderWithProviders(<ProfileScreen />);
    await act(async () => {
      store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
    });

    expect(await screen.findByTestId('profile-personal')).toBeTruthy();
    expect(screen.getByTestId('profile-email').props.children).toBe('ada@example.com');
    expect(
      calls.filter((call) => call.method === 'POST' && call.path === '/profiles'),
    ).toHaveLength(1);
  });

  it('reloads instead of failing when the profile was created concurrently', async () => {
    installFetchMock({
      ...KYC,
      'GET /profiles/me': [fail(404, 'NOT_FOUND'), ok(emptyProfile)],
      'POST /profiles': fail(409, 'PROFILE_EXISTS', 'Profile already exists'),
    });
    await renderWithProviders(<ProfileScreen />);

    expect(await screen.findByTestId('profile-personal')).toBeTruthy();
    expect(screen.queryByTestId('profile-error')).toBeNull();
  });

  it('links to personal information and KYC', async () => {
    installFetchMock({ ...KYC, 'GET /profiles/me': ok(emptyProfile) });
    await renderWithProviders(<ProfileScreen />);

    expect(await screen.findByText('Not started')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profile-personal'));
    expect(router.push).toHaveBeenCalledWith('/profile/personal');
    await fireEvent.press(screen.getByTestId('profile-kyc'));
    expect(router.push).toHaveBeenCalledWith('/kyc');
    await fireEvent.press(screen.getByTestId('profile-cards'));
    expect(router.push).toHaveBeenCalledWith('/cards');
    await fireEvent.press(screen.getByTestId('profile-notifications'));
    expect(router.push).toHaveBeenCalledWith('/notifications/settings');
    await fireEvent.press(screen.getByTestId('profile-referrals'));
    expect(router.push).toHaveBeenCalledWith('/referrals');
  });

  it('links to security, privacy, settings, promotions and help', async () => {
    installFetchMock({ ...KYC, 'GET /profiles/me': ok(emptyProfile) });
    await renderWithProviders(<ProfileScreen />);

    const expected = {
      'profile-security': '/security',
      'profile-privacy': '/settings/privacy',
      'profile-settings': '/settings',
      'profile-promotions': '/promotions',
      'profile-support': '/support',
    };
    for (const [testID, path] of Object.entries(expected)) {
      await fireEvent.press(await screen.findByTestId(testID));
      expect(router.push).toHaveBeenLastCalledWith(path);
    }
  });

  it('signs out after confirmation', async () => {
    installFetchMock({
      ...KYC,
      'GET /profiles/me': ok(emptyProfile),
      'POST /auth/logout': ok(),
    });
    const signOut = jest.spyOn(sessionManager, 'signOut');
    await renderWithProviders(<ProfileScreen />);

    await fireEvent.press(await screen.findByTestId('profile-sign-out'));
    expect(signOut).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
