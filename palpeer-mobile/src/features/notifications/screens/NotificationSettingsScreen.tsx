import { BellRing, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, Switch, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { ErrorState } from '@/components/feedback/StateViews';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
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
import type { DeviceTokenResponse } from '@/types/api/notification';
import { formatDateTime } from '@/utils/datetime';

const PLATFORM_LABELS: Record<DeviceTokenResponse['platform'], string> = {
  IOS: 'iPhone',
  ANDROID: 'Android phone',
  WEB: 'Web',
  OTHER: 'Other device',
};

/** Push is opt-in per install; permission is only requested from here (R-NT-2). */
export function NotificationSettingsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const tokens = useGetPushTokensQuery();
  const [register] = useRegisterPushTokenMutation();
  const [removeToken, removeState] = useDeletePushTokenMutation();
  const [permission, setPermission] = useState<PushPermissionState | null>(null);
  const [rememberedId, setRememberedId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [removing, setRemoving] = useState<DeviceTokenResponse | null>(null);

  const loadLocal = useCallback(async () => {
    const [state, id] = await Promise.all([getPushPermission(), getRememberedPushRecordId()]);
    setPermission(state);
    setRememberedId(id);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getPushPermission(), getRememberedPushRecordId()]).then(([state, id]) => {
      if (!active) return;
      setPermission(state);
      setRememberedId(id);
    });
    return () => {
      active = false;
    };
  }, []);

  const header = <StackHeader title="Notification settings" />;

  if (tokens.error && !tokens.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(tokens.error)} onRetry={() => void tokens.refetch()} />
      </Screen>
    );
  }

  if (!tokens.data || !permission || rememberedId === undefined) {
    return (
      <Screen>
        {header}
        <Skeleton height={72} />
      </Screen>
    );
  }

  const thisRecord = rememberedId
    ? tokens.data.find((item) => item.id === rememberedId)
    : undefined;
  const enabledHere = Boolean(thisRecord?.enabled) && permission.status === 'granted';
  const others = tokens.data.filter((item) => item.id !== rememberedId);

  const enable = async () => {
    setError(null);
    setBlocked(false);
    setBusy(true);
    try {
      let state = await getPushPermission();
      if (state.status !== 'granted' && state.canAskAgain) state = await requestPushPermission();
      setPermission(state);
      if (state.status !== 'granted') {
        setBlocked(true);
        setError('Notifications are turned off for PALPEER in your phone settings.');
        return;
      }
      const record = await register(await buildPushRegistration()).unwrap();
      await rememberPushRecord(record);
      setRememberedId(record.id);
      toast.show({ type: 'success', title: 'Push notifications on' });
    } catch (caught) {
      setError(
        caught instanceof PushUnavailableError ? caught.message : toAppError(caught).message,
      );
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
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
    setRememberedId(null);
    toast.show({ type: 'success', title: 'Push notifications off' });
  };

  const removeOther = async () => {
    if (!removing) return;
    const result = await removeToken(removing.id);
    setRemoving(null);
    if ('error' in result && toAppError(result.error).status !== 404) {
      setError(toAppError(result.error).message);
    }
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={tokens.isFetching && !tokens.isLoading}
          onRefresh={() => {
            void tokens.refetch();
            void loadLocal();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      <Card variant="outlined" padding="md" testID="push-this-device">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Icon icon={BellRing} color={theme.colors.primary} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="bodyStrong">Push notifications on this phone</AppText>
            <AppText variant="caption" tone="secondary">
              {enabledHere
                ? 'On. You can turn them off at any time.'
                : 'Off. Everything still appears in your notification center.'}
            </AppText>
          </View>
          <Switch
            value={enabledHere}
            onValueChange={(value) => void (value ? enable() : disable())}
            disabled={busy}
            accessibilityLabel="Push notifications on this phone"
            trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
            testID="push-switch"
          />
        </View>
      </Card>
      <FormAlert message={error} testID="push-error" />
      {blocked ? (
        <Button
          label="Open phone settings"
          variant="outline"
          onPress={() => void Linking.openSettings()}
          testID="push-open-settings"
        />
      ) : null}

      {others.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }} testID="push-other-devices">
          <AppText variant="overline" tone="muted">
            Other devices receiving notifications
          </AppText>
          {others.map((item) => (
            <Card key={item.id} variant="outlined" padding="md" testID={`push-device-${item.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Icon icon={Smartphone} color={theme.colors.textMuted} />
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="bodyStrong">{PLATFORM_LABELS[item.platform]}</AppText>
                  <AppText variant="caption" tone="muted">
                    {item.enabled ? 'On' : 'Off'} · last seen {formatDateTime(item.lastSeenAt)}
                  </AppText>
                </View>
                <Button
                  label="Remove"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => setRemoving(item)}
                  testID={`push-device-${item.id}-remove`}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <ConfirmDialog
        visible={removing !== null}
        title="Stop notifications on that device?"
        message="It won't receive push notifications until it's turned on again from that device."
        confirmLabel="Remove"
        destructive
        loading={removeState.isLoading}
        onConfirm={() => void removeOther()}
        onCancel={() => setRemoving(null)}
      />
    </Screen>
  );
}
