import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';

import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import {
  useDeletePushTokenMutation,
  useGetPushTokensQuery,
  useRegisterPushTokenMutation,
} from '@/services/api/notificationApi';
import {
  buildPushRegistration,
  getPushPermission,
  getRememberedPushRecordId,
  PushUnavailableError,
  rememberPushRecord,
  requestPushPermission,
  type PushPermissionState,
} from '@/services/push/pushNotifications';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import type { DeviceTokenResponse } from '@/types/api/notification';
import { formatDateTime } from '@/utils/datetime';
import { useAppSelector } from '@/store';

const PLATFORM_LABELS: Record<DeviceTokenResponse['platform'], string> = {
  IOS: 'iPhone',
  ANDROID: 'Android phone',
  WEB: 'Web',
  OTHER: 'Other device',
};

export type NotifDeviceRow = {
  id: string;
  title: string;
  note: string;
};

/** Live props for design Notification settings (push opt-in + other devices). */
export function useLiveNotificationSettings() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const toast = useToast();
  const tokensQ = useGetPushTokensQuery(undefined, { skip: !authenticated });
  const [register] = useRegisterPushTokenMutation();
  const [removeToken, removeState] = useDeletePushTokenMutation();

  const [permission, setPermission] = useState<PushPermissionState | null>(null);
  const [rememberedId, setRememberedId] = useState<string | null | undefined>(undefined);
  const [optedOut, setOptedOut] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const autoEnableAttempted = useRef(false);

  const loadLocal = useCallback(async () => {
    const [state, id, pushOptedOut] = await Promise.all([
      getPushPermission(),
      getRememberedPushRecordId(),
      preferencesStorage.getPushOptedOut(),
    ]);
    setPermission(state);
    setRememberedId(id);
    setOptedOut(pushOptedOut);
  }, []);

  useEffect(() => {
    let active = true;
    void loadLocal().then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [loadLocal]);

  const enable = useCallback(
    async (options?: { silent?: boolean }) => {
      setError(null);
      setBlocked(false);
      setBusy(true);
      try {
        let state = await getPushPermission();
        if (state.status !== 'granted' && state.canAskAgain) {
          state = await requestPushPermission();
        }
        setPermission(state);
        if (state.status !== 'granted') {
          setBlocked(true);
          setError('Notifications are turned off for PALPEER in your phone settings.');
          return;
        }
        const record = await register(await buildPushRegistration()).unwrap();
        await rememberPushRecord(record);
        await preferencesStorage.setPushOptedOut(false);
        setOptedOut(false);
        setRememberedId(record.id);
        if (!options?.silent) {
          toast.show({ type: 'success', title: 'Push notifications on' });
        }
      } catch (caught) {
        setError(
          caught instanceof PushUnavailableError ? caught.message : toAppError(caught).message,
        );
      } finally {
        setBusy(false);
      }
    },
    [register, toast],
  );

  const disable = useCallback(async () => {
    if (!rememberedId) return;
    setError(null);
    setBusy(true);
    const result = await removeToken(rememberedId);
    setBusy(false);
    if ('error' in result && toAppError(result.error).status !== 404) {
      setError(toAppError(result.error).message);
      return;
    }
    await rememberPushRecord(null);
    await preferencesStorage.setPushOptedOut(true);
    setOptedOut(true);
    setRememberedId(null);
    toast.show({ type: 'success', title: 'Push notifications off' });
  }, [rememberedId, removeToken, toast]);

  // Default ON when the user has not explicitly opted out.
  useEffect(() => {
    if (optedOut === null || !permission || rememberedId === undefined) return;
    if (autoEnableAttempted.current || busy) return;
    const alreadyOn = Boolean(rememberedId) && permission.status === 'granted';
    // Only skip when the user turned push off; unset/false means prefer ON.
    if (optedOut === true || alreadyOn) return;
    autoEnableAttempted.current = true;
    void enable({ silent: true });
  }, [optedOut, permission, rememberedId, busy, enable]);

  const tokens = tokensQ.data ?? [];
  const thisRecord = rememberedId ? tokens.find((item) => item.id === rememberedId) : undefined;
  // Default ON: anything except explicit opt-out shows On (while silent register runs too).
  const preferOn = optedOut !== true;
  const enabledHere =
    preferOn &&
    permission?.status !== 'denied' &&
    ((Boolean(thisRecord?.enabled) && permission?.status === 'granted') ||
      Boolean(busy) ||
      !thisRecord ||
      rememberedId === null);

  const otherDevices: NotifDeviceRow[] = useMemo(
    () =>
      tokens
        .filter((item) => item.id !== rememberedId)
        .map((item) => ({
          id: item.id,
          title: PLATFORM_LABELS[item.platform],
          note: `${item.enabled ? 'On' : 'Off'} · last seen ${formatDateTime(item.lastSeenAt) ?? '—'}`,
        })),
    [rememberedId, tokens],
  );

  const loading =
    tokensQ.isLoading ||
    permission === null ||
    rememberedId === undefined ||
    optedOut === null;

  const onToggleThisPhone = useCallback(async () => {
    if (busy) return;
    if (enabledHere) await disable();
    else await enable();
  }, [busy, disable, enable, enabledHere]);

  const onAskRemoveDevice = useCallback((id: string) => {
    setRemovingId(id);
  }, []);

  const onCancelRemove = useCallback(() => {
    setRemovingId(null);
  }, []);

  const onConfirmRemove = useCallback(async () => {
    if (!removingId) return;
    const result = await removeToken(removingId);
    setRemovingId(null);
    if ('error' in result && toAppError(result.error).status !== 404) {
      setError(toAppError(result.error).message);
      return;
    }
    toast.show({ type: 'success', title: 'Device removed' });
  }, [removeToken, removingId, toast]);

  const onOpenPhoneSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const onRetry = useCallback(() => {
    void tokensQ.refetch();
    void loadLocal();
  }, [loadLocal, tokensQ]);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/More');
  }, []);

  return {
    backend: true as const,
    loading,
    loadError: tokensQ.error && !tokensQ.data ? toAppError(tokensQ.error).message : null,
    enabledHere,
    pushNote: enabledHere
      ? 'On. You can turn them off at any time.'
      : 'Off. Alerts still show in Messages.',
    busy,
    error,
    blocked,
    otherDevices,
    removingId,
    removeBusy: removeState.isLoading,
    onToggleThisPhone,
    onAskRemoveDevice,
    onCancelRemove,
    onConfirmRemove,
    onOpenPhoneSettings,
    onRetry,
    onBack,
  };
}
