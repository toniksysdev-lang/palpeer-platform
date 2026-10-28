import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import {
  DENIED,
  GRANTED,
  getDevicePushTokenAsync,
  getExpoPushTokenAsync,
  notifications,
  requestPermissionsAsync,
} from '@/tests/mocks/notifications';
import { renderWithProviders } from '@/tests/render';

import { NotificationDetailScreen } from '../screens/NotificationDetailScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const N1 = '11111111-1111-4111-8111-111111111111';
const N2 = '22222222-2222-4222-8222-222222222222';

const notification = (overrides: Record<string, unknown> = {}) => ({
  id: N1,
  title: 'Referral completed',
  body: 'Someone joined using your referral code REF0123456789',
  category: 'REFERRAL',
  channel: 'EMAIL',
  status: 'SENT',
  referenceType: 'REFERRAL',
  referenceId: '99999999-9999-4999-8999-999999999999',
  readAt: null,
  sentAt: '2026-09-29T10:00:00Z',
  failureReason: null,
  createdAt: '2026-09-29T10:00:00Z',
  ...overrides,
});

const page = (content: unknown[], { number = 0, last = true } = {}) => ({
  content,
  totalElements: content.length,
  totalPages: last ? number + 1 : number + 2,
  number,
  size: 20,
  first: number === 0,
  last,
  empty: content.length === 0,
});

const tokenRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'dt-1',
  platform: 'ANDROID',
  deviceIdentifier: 'install-1',
  enabled: true,
  lastSeenAt: '2026-09-29T10:00:00Z',
  createdAt: '2026-09-29T10:00:00Z',
  updatedAt: '2026-09-29T10:00:00Z',
  ...overrides,
});

const calls = (all: RecordedCall[], method: string, path: string) =>
  all.filter((call) => call.method === method && call.path === path);

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  notifications.reset();
  setSearchParams({});
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('NotificationsScreen', () => {
  it('lists notifications with unread markers and opens a referral notification', async () => {
    const { calls: all } = installFetchMock({
      'GET /notifications': ok(
        page([
          notification(),
          notification({
            id: N2,
            status: 'READ',
            title: 'Welcome',
            referenceType: null,
            category: null,
          }),
        ]),
      ),
      'GET /notifications/unread-count': ok({ count: 1 }),
      [`POST /notifications/${N1}/read`]: ok(notification({ status: 'READ' })),
    });
    await renderWithProviders(<NotificationsScreen />);

    expect(await screen.findByTestId(`notification-${N1}-unread`)).toBeTruthy();
    expect(screen.queryByTestId(`notification-${N2}-unread`)).toBeNull();

    await fireEvent.press(screen.getByTestId(`notification-${N1}`));
    expect(router.push).toHaveBeenCalledWith('/referrals');
    await waitFor(() => expect(calls(all, 'POST', `/notifications/${N1}/read`)).toHaveLength(1));
  });

  it('opens the detail for notifications without a mapped screen and does not re-mark read ones', async () => {
    const { calls: all } = installFetchMock({
      'GET /notifications': ok(
        page([notification({ id: N2, status: 'READ', referenceType: null })]),
      ),
      'GET /notifications/unread-count': ok({ count: 0 }),
    });
    await renderWithProviders(<NotificationsScreen />);

    await fireEvent.press(await screen.findByTestId(`notification-${N2}`));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/notifications/[id]',
      params: { id: N2 },
    });
    expect(all.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('pages with Load more and shows an empty state', async () => {
    let served = 0;
    const { calls: all } = installFetchMock({
      'GET /notifications': () => {
        served += 1;
        return served === 1
          ? ok(page([notification()], { last: false }))
          : ok(page([notification({ id: N2, title: 'Older' })], { number: 1 }));
      },
      'GET /notifications/unread-count': ok({ count: 1 }),
    });
    await renderWithProviders(<NotificationsScreen />);

    await fireEvent.press(await screen.findByTestId('notifications-more'));
    expect(await screen.findByTestId(`notification-${N2}`)).toBeTruthy();
    const second = calls(all, 'GET', '/notifications')[1];
    expect(new URLSearchParams(second?.query ?? '').get('page')).toBe('1');
    expect(new URLSearchParams(second?.query ?? '').get('size')).toBe('20');
  });

  it('shows an empty state', async () => {
    installFetchMock({
      'GET /notifications': ok(page([])),
      'GET /notifications/unread-count': ok({ count: 0 }),
    });
    await renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText('No notifications yet')).toBeTruthy();
  });

  it('shows an error with retry when the list fails', async () => {
    installFetchMock({
      'GET /notifications': fail(500, 'INTERNAL_ERROR', 'Something went wrong'),
      'GET /notifications/unread-count': ok({ count: 0 }),
    });
    await renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
  });
});

describe('NotificationDetailScreen', () => {
  it('loads from the API, marks it read and offers the mapped screen', async () => {
    setSearchParams({ id: N1 });
    const { calls: all } = installFetchMock({
      [`GET /notifications/${N1}`]: ok(notification()),
      [`POST /notifications/${N1}/read`]: ok(notification({ status: 'READ' })),
    });
    await renderWithProviders(<NotificationDetailScreen />);

    expect(await screen.findByTestId('notification-title')).toHaveTextContent('Referral completed');
    await waitFor(() => expect(calls(all, 'POST', `/notifications/${N1}/read`)).toHaveLength(1));
    await fireEvent.press(screen.getByTestId('notification-open'));
    expect(router.push).toHaveBeenCalledWith('/referrals');
  });

  it("says when a notification isn't found (someone else's or deleted)", async () => {
    setSearchParams({ id: N1 });
    installFetchMock({
      [`GET /notifications/${N1}`]: fail(404, 'NOT_FOUND', 'Notification not found'),
    });
    await renderWithProviders(<NotificationDetailScreen />);
    expect(await screen.findByText("This notification wasn't found.")).toBeTruthy();
  });
});

describe('NotificationSettingsScreen', () => {
  it('turns push on by default and registers this phone', async () => {
    const { calls: all } = installFetchMock({
      'GET /notifications/device-tokens': [ok([]), ok([tokenRecord()])],
      'POST /notifications/device-tokens': {
        status: 201,
        body: { success: true, data: tokenRecord(), timestamp: '' },
      },
    });
    await renderWithProviders(<NotificationSettingsScreen />);

    await waitFor(() => expect(calls(all, 'POST', '/notifications/device-tokens')).toHaveLength(1));
    expect(requestPermissionsAsync).toHaveBeenCalled();
    const body = calls(all, 'POST', '/notifications/device-tokens')[0]?.body as Record<
      string,
      string
    >;
    expect(body).toMatchObject({
      token: 'ExponentPushToken[test-token]',
      platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
    });
    expect(getExpoPushTokenAsync).toHaveBeenCalled();
    expect(body.deviceIdentifier).toEqual(expect.any(String));
    expect(await secureStorage.getPushTokenId()).toBe('dt-1');
    await waitFor(() => expect(screen.getByTestId('push-switch').props.value).toBe(true));
  });

  it('points to phone settings when the permission is blocked', async () => {
    notifications.setPermission(DENIED);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { calls: all } = installFetchMock({ 'GET /notifications/device-tokens': ok([]) });
    await renderWithProviders(<NotificationSettingsScreen />);

    // Default-ON attempts enable on load; blocked permission surfaces settings CTA.
    expect(await screen.findByTestId('push-error')).toHaveTextContent(/phone settings/);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(calls(all, 'POST', '/notifications/device-tokens')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('push-open-settings'));
    expect(openSettings).toHaveBeenCalled();
  });

  it('explains when this build has no push credentials', async () => {
    notifications.setPermission(GRANTED);
    getExpoPushTokenAsync.mockRejectedValueOnce(new Error('Expo push unavailable'));
    getDevicePushTokenAsync.mockRejectedValueOnce(new Error('FirebaseApp is not initialized'));
    const { calls: all } = installFetchMock({ 'GET /notifications/device-tokens': ok([]) });
    await renderWithProviders(<NotificationSettingsScreen />);

    expect(await screen.findByTestId('push-error')).toHaveTextContent(
      /Couldn't enable push on this install|aren't available|aren't configured/,
    );
    expect(calls(all, 'POST', '/notifications/device-tokens')).toHaveLength(0);
  });

  it('turns push off for this phone and can remove another device', async () => {
    notifications.setPermission(GRANTED);
    await secureStorage.setPushTokenId('dt-1');
    const { calls: all } = installFetchMock({
      'GET /notifications/device-tokens': () =>
        ok([
          tokenRecord(),
          tokenRecord({ id: 'dt-2', platform: 'IOS', deviceIdentifier: 'other' }),
        ]),
      'DELETE /notifications/device-tokens/dt-1': { status: 204 },
      'DELETE /notifications/device-tokens/dt-2': { status: 204 },
    });
    await renderWithProviders(<NotificationSettingsScreen />);

    await waitFor(() => expect(screen.getByTestId('push-switch').props.value).toBe(true));
    expect(screen.getByTestId('push-device-dt-2')).toHaveTextContent(/iPhone/);
    expect(screen.queryByTestId('push-device-dt-1')).toBeNull();

    await fireEvent(screen.getByTestId('push-switch'), 'valueChange', false);
    await waitFor(() =>
      expect(calls(all, 'DELETE', '/notifications/device-tokens/dt-1')).toHaveLength(1),
    );
    expect(await secureStorage.getPushTokenId()).toBeNull();

    await fireEvent.press(screen.getByTestId('push-device-dt-2-remove'));
    await fireEvent.press(await screen.findByTestId('confirm-dialog-confirm'));
    await waitFor(() =>
      expect(calls(all, 'DELETE', '/notifications/device-tokens/dt-2')).toHaveLength(1),
    );
    await settle();
  });
});
