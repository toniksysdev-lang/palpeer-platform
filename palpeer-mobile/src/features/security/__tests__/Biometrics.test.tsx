import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppSelector } from '@/store';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { appLocked, appUnlocked, biometricRestored } from '@/store/slices/appLockSlice';
import { preferencesLoaded } from '@/store/slices/preferencesSlice';
import { sessionStarted } from '@/store/slices/sessionSlice';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { localAuth } from '@/tests/mocks/localAuthentication';
import { renderWithProviders } from '@/tests/render';

import { OfferBiometricUnlock } from '../OfferBiometricUnlock';
import { LOCK_AFTER_BACKGROUND_MS, useAppLockLifecycle } from '../lock/useAppLockLifecycle';
import { LockScreen } from '../lock/LockScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { SecurityHubScreen } from '../screens/SecurityHubScreen';
import { enterPin, PIN_STATUS, QUESTIONS } from './helpers';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const THIS_DEVICE = 'install-1';
const device = (id: string, identifier: string, enabled = true) => ({
  id,
  deviceIdentifier: identifier,
  platform: 'android',
  deviceName: 'Test Phone',
  enabled,
  lastUsedAt: null,
});

async function startSession() {
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  localAuth.reset();
  await secureStorage.clearAll();
});

describe('secure storage', () => {
  it('drops the biometric binding with the session but keeps the install identifier', async () => {
    await startSession();
    await secureStorage.setBiometricUserId('u-1');
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);

    await secureStorage.clearSession();

    expect(await secureStorage.getBiometricUserId()).toBeNull();
    expect(await secureStorage.loadSession()).toBeNull();
    expect(await secureStorage.getDeviceIdentifier()).toBe(THIS_DEVICE);
  });

  it('removes this device from the backend when signing out with biometrics on', async () => {
    await startSession();
    await secureStorage.setBiometricUserId('u-1');
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    const { calls } = installFetchMock({
      'GET /security/devices': ok([device('d-1', THIS_DEVICE), device('d-2', 'other')]),
      'DELETE /security/devices/d-1': ok(),
      'POST /auth/logout': ok(),
    });

    await sessionManager.signOut();

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /security/devices',
      'DELETE /security/devices/d-1',
      'POST /auth/logout',
    ]);
    expect(await secureStorage.getBiometricUserId()).toBeNull();
  });
});

describe('biometric toggle on the security hub', () => {
  const HUB = {
    'GET /security/pin': ok(PIN_STATUS(true)),
    'GET /security/questions': ok([]),
  };

  async function renderHub(biometricOn = false) {
    const result = await renderWithProviders(<SecurityHubScreen />);
    await act(async () => {
      result.store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
      result.store.dispatch(biometricRestored(biometricOn));
    });
    await screen.findByText(
      'Unlock the app with Face ID or Fingerprint instead of signing in each time',
    );
    return result;
  }

  it('confirms with biometrics, replaces a stale device record, and binds the user', async () => {
    await startSession();
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    const { calls } = installFetchMock({
      ...HUB,
      'GET /security/devices': ok([device('d-old', THIS_DEVICE)]),
      'POST /security/devices': [
        fail(409, 'DEVICE_EXISTS'),
        { status: 201, body: { success: true, data: device('d-new', THIS_DEVICE), timestamp: '' } },
      ],
      'DELETE /security/devices/d-old': ok(),
    });
    const { store } = await renderHub();

    await fireEvent(screen.getByTestId('hub-biometric-switch'), 'valueChange', true);

    await waitFor(() => expect(store.getState().appLock.biometricEnabled).toBe(true));
    expect(await secureStorage.getBiometricUserId()).toBe('u-1');
    const writes = calls.filter((call) => call.method !== 'GET');
    expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /security/devices',
      'DELETE /security/devices/d-old',
      'POST /security/devices',
    ]);
    expect(writes[0]?.body).toMatchObject({
      deviceIdentifier: THIS_DEVICE,
      platform: expect.any(String),
    });
    expect(JSON.stringify(store.getState())).not.toContain(
      (writes[0]?.body as { biometricCredential: string }).biometricCredential,
    );
  });

  it('stays off when the biometric prompt is cancelled', async () => {
    await startSession();
    localAuth.nextResults = [{ success: false, error: 'user_cancel' }];
    const { calls } = installFetchMock({ ...HUB, 'GET /security/devices': ok([]) });
    const { store } = await renderHub();

    await fireEvent(screen.getByTestId('hub-biometric-switch'), 'valueChange', true);

    await waitFor(() => expect(localAuth.nextResults).toHaveLength(0));
    expect(store.getState().appLock.biometricEnabled).toBe(false);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    expect(await secureStorage.getBiometricUserId()).toBeNull();
  });

  it('turns off and removes this device', async () => {
    await startSession();
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    await secureStorage.setBiometricUserId('u-1');
    const { calls } = installFetchMock({
      ...HUB,
      'GET /security/devices': ok([device('d-1', THIS_DEVICE)]),
      'DELETE /security/devices/d-1': ok(),
    });
    const { store } = await renderHub(true);

    await fireEvent(screen.getByTestId('hub-biometric-switch'), 'valueChange', false);

    await waitFor(() => expect(store.getState().appLock.biometricEnabled).toBe(false));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
    expect(await secureStorage.getBiometricUserId()).toBeNull();
  });

  it('explains when no biometrics are enrolled', async () => {
    await startSession();
    localAuth.enrolled = false;
    installFetchMock({ ...HUB, 'GET /security/devices': ok([]) });
    await renderWithProviders(<SecurityHubScreen />);

    expect(
      await screen.findByText('Set up Face ID or Fingerprint in your phone settings first'),
    ).toBeTruthy();
    expect(screen.getByTestId('hub-biometric-switch').props.disabled).toBe(true);
  });
});

describe('post-login biometric offer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderOffer() {
    await startSession();
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    return renderWithProviders(<OfferBiometricUnlock />, {
      prepareStore: (store) => {
        store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
        store.dispatch(
          preferencesLoaded({
            appearance: 'light',
            onboardingSeen: true,
            biometricUnlockPrompted: false,
          }),
        );
        store.dispatch(biometricRestored(false));
      },
    });
  }

  it('offers Fingerprint unlock after the first login and enables it', async () => {
    const { calls } = installFetchMock({
      'GET /security/pin': ok(PIN_STATUS(true)),
      'GET /security/questions': ok(QUESTIONS),
      'GET /security/devices': ok([]),
      'POST /security/devices': {
        status: 201,
        body: { success: true, data: device('d-1', THIS_DEVICE), timestamp: '' },
      },
    });
    const { store } = await renderOffer();

    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    expect(await screen.findByTestId('biometric-offer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('biometric-offer-enable'));

    await waitFor(() => expect(store.getState().appLock.biometricEnabled).toBe(true));
    expect(store.getState().preferences.biometricUnlockPrompted).toBe(true);
    expect(await secureStorage.getBiometricUserId()).toBe('u-1');
    expect(await preferencesStorage.load()).toMatchObject({ biometricUnlockPrompted: true });
    expect(calls.some((call) => call.method === 'POST' && call.path === '/security/devices')).toBe(
      true,
    );
  });

  it('does not ask again after Not now', async () => {
    installFetchMock({
      'GET /security/pin': ok(PIN_STATUS(true)),
      'GET /security/questions': ok(QUESTIONS),
      'GET /security/devices': ok([]),
    });
    const { store } = await renderOffer();

    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    await fireEvent.press(await screen.findByTestId('biometric-offer-dismiss'));
    await waitFor(() => expect(store.getState().preferences.biometricUnlockPrompted).toBe(true));
    expect(store.getState().appLock.biometricEnabled).toBe(false);
    expect(screen.queryByTestId('biometric-offer')).toBeNull();
  });

  it('skips the offer when biometrics were already prompted', async () => {
    installFetchMock({
      'GET /security/pin': ok(PIN_STATUS(true)),
      'GET /security/questions': ok(QUESTIONS),
    });
    await startSession();
    await renderWithProviders(<OfferBiometricUnlock />, {
      prepareStore: (store) => {
        store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
        store.dispatch(
          preferencesLoaded({
            appearance: 'light',
            onboardingSeen: true,
            biometricUnlockPrompted: true,
          }),
        );
      },
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    expect(screen.queryByTestId('biometric-offer')).toBeNull();
  });

  it('waits until PIN and security questions are set before offering', async () => {
    installFetchMock({
      'GET /security/pin': ok(PIN_STATUS(false)),
      'GET /security/questions': ok([]),
    });
    await renderOffer();

    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    expect(screen.queryByTestId('biometric-offer')).toBeNull();
  });
});

describe('LockScreen', () => {
  function renderLocked() {
    return renderWithProviders(<LockScreen />, {
      prepareStore: (store) => store.dispatch(biometricRestored(true)),
    });
  }

  beforeEach(async () => {
    await startSession();
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    await secureStorage.setBiometricUserId('u-1');
  });

  it('unlocks after biometrics when this device is still trusted', async () => {
    installFetchMock({ 'GET /security/devices': ok([device('d-1', THIS_DEVICE)]) });
    const { store } = await renderLocked();

    await waitFor(() => expect(store.getState().appLock.locked).toBe(false));
    expect(localAuth.nextResults).toHaveLength(0);
  });

  it('signs out when the device was disabled elsewhere', async () => {
    installFetchMock({
      'GET /security/devices': ok([device('d-1', THIS_DEVICE, false)]),
      'POST /auth/logout': ok(),
    });
    const signOut = jest.spyOn(sessionManager, 'signOut');
    const { store } = await renderLocked();

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(store.getState().appLock.locked).toBe(true);
    expect(await secureStorage.getBiometricUserId()).toBeNull();
  });

  it('stays locked and explains a biometric lockout', async () => {
    localAuth.nextResults = [{ success: false, error: 'lockout' }];
    const { calls } = installFetchMock({});
    const { store } = await renderLocked();

    expect(await screen.findByText(/locked after too many attempts/)).toBeTruthy();
    expect(store.getState().appLock.locked).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('offers signing in with the password instead without clearing biometric login', async () => {
    localAuth.nextResults = [{ success: false, error: 'user_cancel' }];
    installFetchMock({
      'GET /security/devices': ok([device('d-1', THIS_DEVICE)]),
    });
    const dismiss = jest.spyOn(sessionManager, 'dismissToLogin');
    const signOut = jest.spyOn(sessionManager, 'signOut');
    await renderLocked();

    await waitFor(() =>
      expect(
        screen.getByTestId('lock-use-password').props.accessibilityState?.disabled,
      ).toBeFalsy(),
    );
    await fireEvent.press(screen.getByTestId('lock-use-password'));
    await waitFor(() => expect(dismiss).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
    expect(await secureStorage.getBiometricUserId()).toBe('u-1');
    expect(await secureStorage.loadSession()).not.toBeNull();
  });
});

describe('lock timing', () => {
  function LockProbe() {
    useAppLockLifecycle();
    const locked = useAppSelector((state) => state.appLock.locked);
    return <AppText testID="locked">{String(locked)}</AppText>;
  }

  it('re-locks only after a long enough trip to the background', async () => {
    let handler: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      handler = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const now = jest.spyOn(Date, 'now');
    const { store } = await renderWithProviders(<LockProbe />);
    await act(async () => {
      store.dispatch(biometricRestored(true));
      store.dispatch(appUnlocked());
    });

    now.mockReturnValue(1_000);
    await act(async () => handler?.('background'));
    now.mockReturnValue(1_000 + LOCK_AFTER_BACKGROUND_MS - 1);
    await act(async () => handler?.('active'));
    expect(screen.getByTestId('locked').props.children).toBe('false');

    now.mockReturnValue(10_000);
    await act(async () => handler?.('background'));
    now.mockReturnValue(10_000 + LOCK_AFTER_BACKGROUND_MS);
    await act(async () => handler?.('active'));
    expect(screen.getByTestId('locked').props.children).toBe('true');
    now.mockRestore();
  });

  it('never locks when biometric unlock is off', async () => {
    const { store } = await renderWithProviders(<AppText>x</AppText>);
    await act(async () => {
      store.dispatch(appLocked());
    });
    expect(store.getState().appLock.locked).toBe(false);
  });

  it('locks on cold start before the session restore finishes', async () => {
    await secureStorage.saveSession({ refreshToken: 'refresh-0', userId: 'u-1', email: null });
    await secureStorage.setBiometricUserId('u-1');
    let failFetch: (error: Error) => void = () => {};
    globalThis.fetch = jest.fn(
      () => new Promise<Response>((_resolve, reject) => (failFetch = reject)),
    ) as unknown as typeof fetch;

    function BootProbe() {
      useAppBootstrap();
      return null;
    }
    const { store } = await renderWithProviders(<BootProbe />);

    await waitFor(() => expect(store.getState().appLock.locked).toBe(true));
    expect(globalThis.fetch).toHaveBeenCalled();
    await act(async () => failFetch(new Error('offline')));
  });

  it('does not lock for a different user than the one who enabled biometrics', async () => {
    await secureStorage.saveSession({ refreshToken: 'refresh-0', userId: 'u-2', email: null });
    await secureStorage.setBiometricUserId('u-1');
    let failFetch: (error: Error) => void = () => {};
    globalThis.fetch = jest.fn(
      () => new Promise<Response>((_resolve, reject) => (failFetch = reject)),
    ) as unknown as typeof fetch;

    function BootProbe() {
      useAppBootstrap();
      return null;
    }
    const { store } = await renderWithProviders(<BootProbe />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(store.getState().appLock.locked).toBe(false);
    await act(async () => failFetch(new Error('offline')));
  });
});

describe('DevicesScreen', () => {
  it('turns biometric unlock off when this device is removed', async () => {
    await startSession();
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    await secureStorage.setBiometricUserId('u-1');
    const { calls } = installFetchMock({
      'GET /security/devices': [
        ok([device('d-1', THIS_DEVICE), device('d-2', 'other')]),
        ok([device('d-2', 'other')]),
      ],
      'POST /security/pin/verify': ok(),
      'DELETE /security/devices/d-1': ok(),
    });
    const { store } = await renderWithProviders(<DevicesScreen />);
    await act(async () => {
      store.dispatch(biometricRestored(true));
      store.dispatch(appUnlocked());
    });

    expect(await screen.findByText('android · This device')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('device-remove-d-1'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    await enterPin('pin-prompt-entry', '1234');

    await waitFor(() => expect(store.getState().appLock.biometricEnabled).toBe(false));
    expect(
      calls.some((call) => call.method === 'DELETE' && call.path === '/security/devices/d-1'),
    ).toBe(true);
    expect(await secureStorage.getBiometricUserId()).toBeNull();
  });

  it('keeps biometrics on when another device is disabled', async () => {
    await startSession();
    await secureStorage.setDeviceIdentifier(THIS_DEVICE);
    await secureStorage.setBiometricUserId('u-1');
    const { calls } = installFetchMock({
      'GET /security/devices': [
        ok([device('d-1', THIS_DEVICE), device('d-2', 'other')]),
        ok([device('d-1', THIS_DEVICE), device('d-2', 'other', false)]),
      ],
      'POST /security/pin/verify': ok(),
      'POST /security/devices/d-2/disable': ok(device('d-2', 'other', false)),
    });
    const { store } = await renderWithProviders(<DevicesScreen />);
    await act(async () => {
      store.dispatch(biometricRestored(true));
    });

    await fireEvent.press(await screen.findByTestId('device-toggle-d-2'));
    await enterPin('pin-prompt-entry', '1234');

    await waitFor(() =>
      expect(calls.some((call) => call.path === '/security/devices/d-2/disable')).toBe(true),
    );
    expect(store.getState().appLock.biometricEnabled).toBe(true);
    expect(await secureStorage.getBiometricUserId()).toBe('u-1');
  });
});
