import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { localAuth } from '@/tests/mocks/localAuthentication';
import { preventScreenCaptureAsync } from '@/tests/mocks/media';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { LoginScreen } from '../screens/LoginScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const TOKENS = {
  userId: 'u-1',
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
};

const THIS_DEVICE = 'device-login-1';

describe('LoginScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setSearchParams({});
    await secureStorage.clearAll();
    localAuth.reset();
  });

  it('shows the design copy and links without a sticky footer', async () => {
    installFetchMock({});
    await renderWithProviders(<LoginScreen />);

    expect(screen.getByLabelText('PALPEER')).toBeTruthy();
    expect(screen.getByText('Login to your account')).toBeTruthy();
    expect(screen.getByText('Forgot Password?')).toBeTruthy();
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Need help?')).toBeTruthy();
    expect(screen.queryByTestId('login-biometric')).toBeNull();

    await fireEvent.press(screen.getByTestId('go-register'));
    expect(router.push).toHaveBeenCalledWith('/enter-phone');
    await fireEvent.press(screen.getByTestId('go-forgot-password'));
    expect(router.push).toHaveBeenCalledWith('/forgot-password');
    await fireEvent.press(screen.getByTestId('go-support'));
    expect(router.push).toHaveBeenCalledWith('/support');
  });

  it('offers fingerprint login when biometric unlock is set up for a parked session', async () => {
    await secureStorage.saveSession({
      refreshToken: 'refresh-parked',
      userId: 'u-1',
      email: 'ada@example.com',
    });
    await secureStorage.setBiometricUserId('u-1');
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    installFetchMock({
      'GET /security/devices': ok([
        {
          id: 'd-1',
          deviceIdentifier: THIS_DEVICE,
          deviceName: 'Phone',
          platform: 'ANDROID',
          enabled: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastUsedAt: null,
        },
      ]),
      'POST /auth/refresh': ok({
        userId: 'u-1',
        accessToken: 'access-bio',
        refreshToken: 'refresh-bio',
        tokenType: 'Bearer',
      }),
    });

    const { store } = await renderWithProviders(<LoginScreen />);

    expect(await screen.findByTestId('login-biometric')).toBeTruthy();
    expect(screen.getByTestId('login-email').props.value).toBe('ada@example.com');
    await fireEvent.press(screen.getByTestId('login-biometric'));

    await waitFor(() => expect(sessionManager.getAccessToken()).toBe('access-bio'));
    expect(store.getState().session.status).toBe('authenticated');
    expect(store.getState().appLock.biometricEnabled).toBe(true);
    expect(store.getState().appLock.locked).toBe(false);
  });

  it('validates required fields before calling the API', async () => {
    const { calls } = installFetchMock({});
    await renderWithProviders(<LoginScreen />);

    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Enter your email or phone number')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('signs in with a phone number as the identifier', async () => {
    const { calls } = installFetchMock({ 'POST /auth/login': ok(TOKENS) });
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-email'), '+2348000000000');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'correct-horse');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(sessionManager.getAccessToken()).toBe('access-1'));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/login',
      body: {
        email: '+2348000000000',
        password: 'correct-horse',
        deviceIdentifier: expect.any(String),
        platform: expect.any(String),
      },
    });
    expect(await secureStorage.loadSession()).toEqual({
      refreshToken: 'refresh-1',
      userId: 'u-1',
      email: null,
    });
  });

  it('signs in, stores the refresh token securely and keeps the access token in memory', async () => {
    const { calls } = installFetchMock({ 'POST /auth/login': ok(TOKENS) });
    const { store } = await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-email'), '  Ada@Example.com ');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'correct-horse');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(sessionManager.getAccessToken()).toBe('access-1'));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/login',
      body: {
        email: 'Ada@Example.com',
        password: 'correct-horse',
        deviceIdentifier: expect.any(String),
        platform: expect.any(String),
      },
    });
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(await secureStorage.loadSession()).toEqual({
      refreshToken: 'refresh-1',
      userId: 'u-1',
      email: 'ada@example.com',
    });
    const reduxState = JSON.stringify(store.getState());
    expect(reduxState).not.toContain('correct-horse');
    expect(reduxState).not.toContain('access-1');
    expect(reduxState).not.toContain('refresh-1');
  });

  it('blocks screen capture while credentials are on screen', async () => {
    installFetchMock({});
    await renderWithProviders(<LoginScreen />);
    await waitFor(() =>
      expect(preventScreenCaptureAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^palpeer-sensitive-/),
      ),
    );
  });

  it('shows a friendly message for wrong credentials', async () => {
    installFetchMock({
      'POST /auth/login': fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials'),
    });
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-email'), 'ada@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrong-pass');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(await screen.findByText('Email/phone or password is incorrect.')).toBeTruthy();
    expect(await secureStorage.loadSession()).toBeNull();
  });

  it('explains a disabled account', async () => {
    installFetchMock({
      'POST /auth/login': fail(403, 'USER_DISABLED', 'User account is disabled'),
    });
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-email'), 'ada@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'whatever1');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(
      await screen.findByText('This account has been disabled. Please contact support.'),
    ).toBeTruthy();
  });

  it('prefills the email and shows the notice passed from verification', async () => {
    installFetchMock({});
    setSearchParams({ email: 'ada@example.com', notice: 'verified' });
    await renderWithProviders(<LoginScreen />);

    expect(screen.getByTestId('login-email').props.value).toBe('ada@example.com');
    expect(screen.getByText('Your account is ready. Sign in to continue.')).toBeTruthy();
  });
});
