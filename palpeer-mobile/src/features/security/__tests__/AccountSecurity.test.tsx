import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { signedOut } from '@/store/slices/sessionSlice';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { SecurityHubScreen } from '../screens/SecurityHubScreen';
import { SessionsScreen } from '../screens/SessionsScreen';
import { PIN_STATUS } from './helpers';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const THIS = {
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-09-29T07:00:00Z',
  expiresAt: '2026-10-13T07:00:00Z',
  current: true,
};
const OTHER = {
  id: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-09-20T10:00:00Z',
  expiresAt: '2026-10-04T10:00:00Z',
  current: false,
};

async function fillPasswordForm(current: string, next: string, confirm = next) {
  await fireEvent.changeText(screen.getByTestId('password-current'), current);
  await fireEvent.changeText(screen.getByTestId('password-new'), next);
  await fireEvent.changeText(screen.getByTestId('password-confirm'), confirm);
  await fireEvent.press(screen.getByTestId('password-submit'));
}

describe('Account security', () => {
  let signOut: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    await secureStorage.clearAll();
    await sessionManager.start(
      { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
      'ada@example.com',
    );
    signOut = jest.spyOn(sessionManager, 'signOut');
  });

  afterEach(() => signOut.mockRestore());

  describe('ChangePasswordScreen', () => {
    it('validates locally with the backend limits and sends nothing', async () => {
      const { calls } = installFetchMock({});
      await renderWithProviders(<ChangePasswordScreen />);

      await fillPasswordForm('old-password', 'short');
      expect(await screen.findByText('Password must be at least 8 characters')).toBeTruthy();

      await fillPasswordForm('old-password', 'new-password-1', 'new-password-2');
      expect(await screen.findByText('Passwords do not match')).toBeTruthy();
      expect(calls).toHaveLength(0);
    });

    it('shows a wrong current password on its field and stays signed in', async () => {
      installFetchMock({
        'POST /auth/password/change': fail(
          400,
          'INVALID_CURRENT_PASSWORD',
          'Current password is incorrect',
        ),
      });
      await renderWithProviders(<ChangePasswordScreen />);

      await fillPasswordForm('wrong-password', 'new-password-1');
      expect(await screen.findByText('Your current password is incorrect.')).toBeTruthy();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('changes the password without storing it and signs out everywhere', async () => {
      const { calls } = installFetchMock({
        'POST /auth/password/change': ok(undefined, 'Password changed'),
        'POST /auth/logout': ok(),
      });
      const { store } = await renderWithProviders(<ChangePasswordScreen />);

      await fillPasswordForm('old-password', 'new-password-1');

      await waitFor(() => expect(signOut).toHaveBeenCalledWith('passwordChanged'));
      const change = calls.find((call) => call.path === '/auth/password/change');
      expect(change?.body).toEqual({
        currentPassword: 'old-password',
        newPassword: 'new-password-1',
      });
      expect(change?.headers.Authorization).toBe('Bearer access-0');
      expect(JSON.stringify(store.getState())).not.toMatch(/old-password|new-password-1/);
    });
  });

  describe('SessionsScreen', () => {
    it("flags this phone using the stored refresh token and doesn't cache it", async () => {
      const { calls } = installFetchMock({ 'GET /auth/sessions': ok([THIS, OTHER]) });
      const { store } = await renderWithProviders(<SessionsScreen />);

      expect(await screen.findByText('This phone')).toBeTruthy();
      expect(screen.getByText('Session 2')).toBeTruthy();
      expect(calls[0]?.headers['X-Refresh-Token']).toBe('refresh-0');
      expect(JSON.stringify(store.getState())).not.toContain('refresh-0');
    });

    it('ends another session after confirmation and refreshes the list', async () => {
      let revoked = false;
      const { calls } = installFetchMock({
        'GET /auth/sessions': () => ok(revoked ? [THIS] : [THIS, OTHER]),
        [`POST /auth/sessions/${OTHER.id}/revoke`]: () => {
          revoked = true;
          return ok(undefined, 'Session revoked');
        },
      });
      await renderWithProviders(<SessionsScreen />);

      await fireEvent.press(await screen.findByTestId(`session-end-${OTHER.id}`));
      expect(screen.getByText('End this session?')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));

      await waitFor(() => expect(screen.queryByTestId(`session-${OTHER.id}`)).toBeNull());
      expect(await screen.findByText('Session ended')).toBeTruthy();
      expect(calls.filter((call) => call.path.endsWith('/revoke'))).toHaveLength(1);
      expect(signOut).not.toHaveBeenCalled();
    });

    it('treats an already-ended session as ended', async () => {
      installFetchMock({
        'GET /auth/sessions': ok([THIS, OTHER]),
        [`POST /auth/sessions/${OTHER.id}/revoke`]: fail(404, 'RESOURCE_NOT_FOUND'),
      });
      await renderWithProviders(<SessionsScreen />);

      await fireEvent.press(await screen.findByTestId(`session-end-${OTHER.id}`));
      await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
      expect(await screen.findByText('Session ended')).toBeTruthy();
    });

    it('signs out here when the current session is ended', async () => {
      installFetchMock({
        'GET /auth/sessions': ok([THIS, OTHER]),
        [`POST /auth/sessions/${THIS.id}/revoke`]: ok(),
        'POST /auth/logout': ok(),
      });
      await renderWithProviders(<SessionsScreen />);

      await fireEvent.press(await screen.findByTestId(`session-end-${THIS.id}`));
      expect(screen.getByText('Sign out on this phone?')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
      await waitFor(() => expect(signOut).toHaveBeenCalledWith('sessionEnded'));
    });

    it('signs out of all devices after confirmation', async () => {
      const { calls } = installFetchMock({
        'GET /auth/sessions': ok([THIS, OTHER]),
        'POST /auth/sessions/revoke-all': ok(undefined, 'All sessions revoked'),
        'POST /auth/logout': ok(),
      });
      await renderWithProviders(<SessionsScreen />);

      await fireEvent.press(await screen.findByTestId('sessions-end-all'));
      expect(calls.some((call) => call.path === '/auth/sessions/revoke-all')).toBe(false);
      await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
      await waitFor(() => expect(signOut).toHaveBeenCalledWith('allSessionsEnded'));
    });

    it('stays signed in when ending all sessions fails', async () => {
      installFetchMock({
        'GET /auth/sessions': ok([THIS]),
        'POST /auth/sessions/revoke-all': fail(500, 'INTERNAL_ERROR'),
      });
      await renderWithProviders(<SessionsScreen />);

      await fireEvent.press(await screen.findByTestId('sessions-end-all'));
      await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
      await waitFor(() => expect(screen.queryByText('Sign out of all devices?')).toBeNull());
      expect(signOut).not.toHaveBeenCalled();
      expect(screen.getByTestId(`session-${THIS.id}`)).toBeTruthy();
    });

    it('shows an error with retry when the list fails to load', async () => {
      installFetchMock({ 'GET /auth/sessions': fail(500, 'INTERNAL_ERROR') });
      await renderWithProviders(<SessionsScreen />);
      expect(await screen.findByText('Something went wrong')).toBeTruthy();
    });
  });

  it('links to password and sessions from the security hub', async () => {
    installFetchMock({
      'GET /security/pin': ok(PIN_STATUS(true)),
      'GET /security/questions': ok([]),
      'GET /security/devices': ok([]),
    });
    await renderWithProviders(<SecurityHubScreen />);

    await fireEvent.press(await screen.findByTestId('hub-password'));
    expect(router.push).toHaveBeenCalledWith('/security/password');
    await fireEvent.press(screen.getByTestId('hub-sessions'));
    expect(router.push).toHaveBeenCalledWith('/security/sessions');
  });

  it('offers help from the login screen', async () => {
    installFetchMock({});
    await renderWithProviders(<LoginScreen />);
    await fireEvent.press(screen.getByTestId('go-support'));
    expect(router.push).toHaveBeenCalledWith('/support');
  });

  it.each([
    ['passwordChanged', /Your password was changed/],
    ['allSessionsEnded', /signed out on all devices/],
    ['sessionEnded', /This session was ended/],
  ] as const)('explains a %s sign-out on the login screen', async (reason, text) => {
    installFetchMock({});
    await renderWithProviders(<LoginScreen />, {
      prepareStore: (store) => store.dispatch(signedOut(reason)),
    });
    expect(screen.getByText(text)).toBeTruthy();
  });
});
