import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { baseApi } from '@/services/api/baseApi';
import {
  NOTIFICATION_LIST,
  NOTIFICATION_UNREAD,
  notificationApi,
} from '@/services/api/notificationApi';
import { pushTarget } from '@/services/navigation/deepLinks';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';
import {
  buildPushRegistration,
  configureForegroundPresentation,
  getPushPermission,
  getRememberedPushRecordId,
  rememberPushRecord,
} from '@/services/push/pushNotifications';
import { useAppDispatch, useAppSelector } from '@/store';
import { logger } from '@/utils/logger';

import { useToast } from './ToastProvider';

/** Money-movement pushes should refresh wallet balances without waiting for the status screen. */
const WALLET_LIST_TAG = { type: 'Wallet' as const, id: 'LIST' };

/**
 * Push behaviour for the whole app (R-NT-3):
 * - received while open: phone system banner/sound + in-app toast + notification center refresh;
 * - background / killed: FCM shows the OS heads-up alert on the high-importance channel;
 * - tapped from the background or a closed app: the destination is queued and opened once the
 *   signed-in navigator is ready (after sign-in if needed), and the screen refetches;
 * - this install's registration is refreshed after sign-in and when the OS rotates the token,
 *   but only if the user turned push on here.
 *
 * Foreground presentation is configured in an effect (not at module load) so devices without
 * Google Play Services can still open the app before any FCM/native call runs.
 */
export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const authenticatedRef = useRef(authenticated);
  const toastRef = useRef(toast);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    authenticatedRef.current = authenticated;
    toastRef.current = toast;
  }, [authenticated, toast]);

  useEffect(() => {
    configureForegroundPresentation();
  }, []);

  const refresh = useCallback(() => {
    dispatch(baseApi.util.invalidateTags([NOTIFICATION_LIST, NOTIFICATION_UNREAD]));
  }, [dispatch]);

  useEffect(() => {
    if (isWeb) return;
    try {
      const subscription = Notifications.addNotificationReceivedListener((notification) => {
        if (!authenticatedRef.current) return;
        refresh();
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        const category = typeof data?.category === 'string' ? data.category.toUpperCase() : '';
        if (
          category === 'TRANSACTION' ||
          category === 'FUNDING' ||
          category === 'EXCHANGE' ||
          category === 'WITHDRAWAL'
        ) {
          dispatch(baseApi.util.invalidateTags([WALLET_LIST_TAG]));
        }
        const { title, body } = notification.request.content;
        toastRef.current.show({
          type: 'info',
          title: title || 'New notification',
          message: body || undefined,
        });
      });
      return () => subscription.remove();
    } catch (error) {
      logger.warn('Push receive listener unavailable', { error });
      return undefined;
    }
  }, [dispatch, isWeb, refresh]);

  useEffect(() => {
    if (isWeb) return;
    try {
      const handled = new Set<string>();
      const open = (response: Notifications.NotificationResponse) => {
        const id = response.notification.request.identifier;
        if (handled.has(id)) return;
        handled.add(id);
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        pendingNavigation.set(pushTarget(response.notification.request.content.data));
        if (authenticatedRef.current) refresh();
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      };
      const subscription = Notifications.addNotificationResponseReceivedListener(open);
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) open(response);
        })
        .catch(() => undefined);
      return () => subscription.remove();
    } catch (error) {
      logger.warn('Push response listener unavailable', { error });
      return undefined;
    }
  }, [isWeb, refresh]);

  useEffect(() => {
    if (isWeb || !authenticated) return;
    const sync = async (token?: string) => {
      const rememberedId = await getRememberedPushRecordId();
      if (!rememberedId) return;
      try {
        const permission = await getPushPermission();
        if (permission.status !== 'granted') {
          await dispatch(notificationApi.endpoints.deletePushToken.initiate(rememberedId));
          await rememberPushRecord(null);
          return;
        }
        const record = await dispatch(
          notificationApi.endpoints.registerPushToken.initiate(await buildPushRegistration(token)),
        ).unwrap();
        await rememberPushRecord(record);
      } catch (error) {
        logger.warn('Push registration refresh failed', { error });
      }
    };
    void sync();
    try {
      const subscription = Notifications.addPushTokenListener((token) => {
        if (typeof token.data === 'string') void sync(token.data);
      });
      return () => subscription.remove();
    } catch (error) {
      logger.warn('Push token listener unavailable', { error });
      return undefined;
    }
  }, [authenticated, dispatch, isWeb]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && authenticatedRef.current) {
        dispatch(baseApi.util.invalidateTags([NOTIFICATION_UNREAD]));
      }
    });
    return () => subscription.remove();
  }, [dispatch]);

  return children;
}
