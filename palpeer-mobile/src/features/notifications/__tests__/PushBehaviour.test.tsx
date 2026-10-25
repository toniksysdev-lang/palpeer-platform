import { act, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { PushNotificationsProvider } from '@/providers/PushNotificationsProvider';
import { sessionManager } from '@/services/auth/session';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';
import { configureForegroundPresentation } from '@/services/push/pushNotifications';
import { secureStorage } from '@/services/storage/secureStorage';
import { sessionStarted } from '@/store/slices/sessionSlice';
import { installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router } from '@/tests/mocks/expoRouter';
import {
  DENIED,
  GRANTED,
  notifications,
  setNotificationHandler,
} from '@/tests/mocks/notifications';
import { renderWithProviders } from '@/tests/render';

import { NotificationBell } from '../components/NotificationBell';
import { usePendingNavigation } from '../usePendingNavigation';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const PLATFORM = Platform.OS === 'android' ? 'ANDROID' : 'IOS';

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

const calls = (all: RecordedCall[], method: string, path: string) =>
  all.filter((call) => call.method === method && call.path === path);

/** Stands in for the signed-in tab layout, which opens queued destinations. */
function SignedInNavigator() {
  usePendingNavigation();
  return <NotificationBell />;
}

async function renderApp({
  signedIn = true,
  navigator = signedIn,
  children,
}: { signedIn?: boolean; navigator?: boolean; children?: ReactNode } = {}) {
  return renderWithProviders(
    <PushNotificationsProvider>
      {navigator ? <SignedInNavigator /> : null}
      {children}
    </PushNotificationsProvider>,
    {
      prepareStore: (store) => {
        if (signedIn) store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
      },
    },
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  notifications.reset();
  pendingNavigation.clear();
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('foreground', () => {
  it('shows no system banner or sound while the app is open, but keeps it in the list', async () => {
    configureForegroundPresentation();
    const handler = setNotificationHandler.mock.calls.at(-1)?.[0] as {
      handleNotification: () => Promise<Record<string, boolean>>;
    };
    await expect(handler.handleNotification()).resolves.toEqual({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it('shows an in-app toast and refreshes the unread badge', async () => {
    let count = 0;
    installFetchMock({ 'GET /notifications/unread-count': () => ok({ count }) });
    await renderApp();
    await settle();
    expect(screen.queryByTestId('home-notifications-badge')).toBeNull();

    count = 1;
    await act(async () => {
      notifications.receive({ title: 'Referral completed', body: 'Someone joined' });
    });

    expect(await screen.findByText('Referral completed')).toBeTruthy();
    expect(screen.getByText('Someone joined')).toBeTruthy();
    expect(await screen.findByTestId('home-notifications-badge')).toHaveTextContent('1');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('ignores pushes while signed out', async () => {
    installFetchMock({});
    await renderApp({ signedIn: false });
    await act(async () => {
      notifications.receive({ title: 'Referral completed', body: 'Someone joined' });
    });
    expect(screen.queryByText('Referral completed')).toBeNull();
  });

  it('refreshes the unread count when the app comes back to the foreground', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    const original = AppState.addEventListener;
    AppState.addEventListener = ((_type: string, listener: (state: AppStateStatus) => void) => {
      listeners.push(listener);
      return { remove: () => undefined };
    }) as typeof AppState.addEventListener;
    const { calls: all } = installFetchMock({
      'GET /notifications/unread-count': ok({ count: 0 }),
    });
    await renderApp();
    await settle();
    const before = calls(all, 'GET', '/notifications/unread-count').length;

    await act(async () => listeners.forEach((listener) => listener('active')));
    await settle();
    expect(calls(all, 'GET', '/notifications/unread-count').length).toBeGreaterThan(before);
    AppState.addEventListener = original;
  });
});

describe('background and closed app', () => {
  it('opens the notification when tapped from the background', async () => {
    installFetchMock({ 'GET /notifications/unread-count': ok({ count: 1 }) });
    await renderApp();

    await act(async () => {
      notifications.tap({ title: 'Hi', data: { notificationId: ID } });
    });
    await settle();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/notifications/${ID}`);
  });

  it('opens the notification that launched the app, once', async () => {
    installFetchMock({ 'GET /notifications/unread-count': ok({ count: 1 }) });
    notifications.setLaunchResponse(
      { title: 'Hi', data: { referenceType: 'REFERRAL' } },
      'launch-1',
    );
    await renderApp();
    await settle();
    // the OS can also deliver the same response to the listener
    await act(async () => {
      notifications.tap(
        { title: 'Hi', data: { referenceType: 'REFERRAL' } },
        { identifier: 'launch-1' },
      );
    });
    await settle();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/referrals');
  });

  it('waits for sign-in before opening a tapped notification', async () => {
    installFetchMock({ 'GET /notifications/unread-count': ok({ count: 0 }) });
    const { store, rerender } = await renderApp({ signedIn: false });
    await act(async () => {
      notifications.tap({ title: 'Hi', data: { notificationId: ID } });
    });
    await settle();
    expect(router.push).not.toHaveBeenCalled();

    await act(async () => {
      store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
    });
    await rerender(
      <PushNotificationsProvider>
        <SignedInNavigator />
      </PushNotificationsProvider>,
    );
    await settle();
    expect(router.push).toHaveBeenCalledWith(`/notifications/${ID}`);
  });

  it('ignores action buttons other than the notification itself', async () => {
    installFetchMock({ 'GET /notifications/unread-count': ok({ count: 0 }) });
    await renderApp();
    await act(async () => {
      notifications.tap({ data: { notificationId: ID } }, { actionIdentifier: 'dismiss' });
    });
    await settle();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('registration upkeep', () => {
  const tokenRecord = (id = 'dt-1') => ({
    id,
    platform: 'ANDROID',
    deviceIdentifier: 'install-1',
    enabled: true,
    lastSeenAt: '2026-09-29T10:00:00Z',
    createdAt: '2026-09-29T10:00:00Z',
    updatedAt: '2026-09-29T10:00:00Z',
  });

  it('does nothing when push was never turned on here', async () => {
    notifications.setPermission(GRANTED);
    const { calls: all } = installFetchMock({
      'GET /notifications/unread-count': ok({ count: 0 }),
    });
    await renderApp();
    await settle();
    expect(calls(all, 'POST', '/notifications/device-tokens')).toHaveLength(0);
  });

  it('re-registers after sign-in and when the OS rotates the token', async () => {
    notifications.setPermission(GRANTED);
    await secureStorage.setPushTokenId('dt-1');
    const { calls: all } = installFetchMock({
      'GET /notifications/unread-count': ok({ count: 0 }),
      'POST /notifications/device-tokens': {
        status: 201,
        body: { success: true, data: tokenRecord(), timestamp: '' },
      },
    });
    await renderApp();
    await waitFor(() => expect(calls(all, 'POST', '/notifications/device-tokens')).toHaveLength(1));
    expect(calls(all, 'POST', '/notifications/device-tokens')[0]?.body).toMatchObject({
      token: 'ExponentPushToken[test-token]',
      platform: PLATFORM,
    });

    await act(async () => notifications.rotateToken('fcm-token-2'));
    await waitFor(() => expect(calls(all, 'POST', '/notifications/device-tokens')).toHaveLength(2));
    expect(calls(all, 'POST', '/notifications/device-tokens')[1]?.body).toMatchObject({
      token: 'fcm-token-2',
    });
  });

  it('removes the registration when the permission was revoked in phone settings', async () => {
    notifications.setPermission(DENIED);
    await secureStorage.setPushTokenId('dt-1');
    const { calls: all } = installFetchMock({
      'GET /notifications/unread-count': ok({ count: 0 }),
      'DELETE /notifications/device-tokens/dt-1': { status: 204 },
    });
    await renderApp();
    await waitFor(() =>
      expect(calls(all, 'DELETE', '/notifications/device-tokens/dt-1')).toHaveLength(1),
    );
    await waitFor(async () => expect(await secureStorage.getPushTokenId()).toBeNull());
  });

  it('removes this phone’s registration on sign-out', async () => {
    await secureStorage.setPushTokenId('dt-1');
    const { calls: all } = installFetchMock({
      'DELETE /notifications/device-tokens/dt-1': { status: 204 },
      'POST /auth/logout': ok(),
    });
    await sessionManager.signOut();
    const removal = calls(all, 'DELETE', '/notifications/device-tokens/dt-1')[0];
    expect(removal?.headers.Authorization).toBe('Bearer access-0');
    expect(await secureStorage.getPushTokenId()).toBeNull();
  });
});
