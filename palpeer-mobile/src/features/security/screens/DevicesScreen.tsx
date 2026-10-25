import { Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import {
  useDeleteDeviceMutation,
  useGetDevicesQuery,
  useSetDeviceEnabledMutation,
} from '@/services/api/securityApi';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { biometricChanged } from '@/store/slices/appLockSlice';
import type { DeviceResponse } from '@/types/api/security';

import { usePinPrompt } from '../PinPromptProvider';

/** Devices registered for biometric unlock. Disabling or removing one revokes its unlock. */
export function DevicesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const { requestPin } = usePinPrompt();
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const devices = useGetDevicesQuery();
  const [setEnabled, toggleState] = useSetDeviceEnabledMutation();
  const [deleteDevice, deleteState] = useDeleteDeviceMutation();
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DeviceResponse | null>(null);

  useEffect(() => {
    let active = true;
    void secureStorage.getDeviceIdentifier().then((identifier) => {
      if (active) setThisDevice(identifier);
    });
    return () => {
      active = false;
    };
  }, []);

  const revokeLocalUnlock = async (device: DeviceResponse) => {
    if (device.deviceIdentifier !== thisDevice || !biometricEnabled) return;
    await secureStorage.setBiometricUserId(null);
    dispatch(biometricChanged(false));
    toast.show({ type: 'info', title: 'Biometric unlock turned off on this device' });
  };

  const toggle = async (device: DeviceResponse) => {
    const disabling = device.enabled;
    if (disabling) {
      const confirmed = await requestPin({
        title: 'Confirm with your PIN',
        message: 'Enter your PIN to disable biometric unlock on this device.',
      });
      if (!confirmed) return;
    }
    const result = await setEnabled({ deviceId: device.id, enabled: !device.enabled });
    if ('error' in result) {
      toast.show({ type: 'error', title: toAppError(result.error).message });
      return;
    }
    if (disabling) await revokeLocalUnlock(device);
  };

  const remove = async () => {
    if (!removing) return;
    const device = removing;
    setRemoving(null);
    const confirmed = await requestPin({
      title: 'Confirm with your PIN',
      message:
        device.deviceIdentifier === thisDevice
          ? 'Enter your PIN to remove this phone and turn off biometric unlock.'
          : 'Enter your PIN to remove biometric unlock on that device.',
    });
    if (!confirmed) return;
    const result = await deleteDevice(device.id);
    if ('error' in result && toAppError(result.error).kind !== 'notFound') {
      toast.show({ type: 'error', title: toAppError(result.error).message });
      return;
    }
    await revokeLocalUnlock(device);
    toast.show({ type: 'success', title: 'Device removed' });
  };

  const header = <StackHeader title="Registered devices" />;

  if (devices.error && !devices.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(devices.error)} onRetry={() => void devices.refetch()} />
      </Screen>
    );
  }

  if (!devices.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={96} />
        <Skeleton height={96} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={devices.isFetching && !devices.isLoading}
          onRefresh={() => void devices.refetch()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      <AppText tone="secondary">
        Devices where biometric unlock was turned on. Disable or remove a device you no longer use —
        it will need your password to sign in.
      </AppText>
      {devices.data.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No registered devices"
          message="Turn on biometric unlock in Security to register this device."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {devices.data.map((device) => {
            const current = device.deviceIdentifier === thisDevice;
            return (
              <Card key={device.id} variant="outlined" padding="md" testID={`device-${device.id}`}>
                <View style={{ gap: theme.spacing.md }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
                  >
                    <Icon icon={Smartphone} color={theme.colors.primary} />
                    <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {device.deviceName ?? 'Unnamed device'}
                      </AppText>
                      <AppText variant="caption" tone="secondary">
                        {[device.platform, current ? 'This device' : null]
                          .filter(Boolean)
                          .join(' · ') || 'Unknown platform'}
                      </AppText>
                    </View>
                    <Badge
                      label={device.enabled ? 'Active' : 'Disabled'}
                      tone={device.enabled ? 'success' : 'neutral'}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={device.enabled ? 'Disable' : 'Enable'}
                        variant="outline"
                        onPress={() => void toggle(device)}
                        loading={
                          toggleState.isLoading && toggleState.originalArgs?.deviceId === device.id
                        }
                        testID={`device-toggle-${device.id}`}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Remove"
                        variant="ghost"
                        onPress={() => setRemoving(device)}
                        testID={`device-remove-${device.id}`}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
      <ConfirmDialog
        visible={removing !== null}
        title="Remove this device?"
        message={
          removing?.deviceIdentifier === thisDevice
            ? 'Biometric unlock will be turned off on this phone.'
            : 'That device will no longer unlock with biometrics.'
        }
        confirmLabel="Remove"
        destructive
        loading={deleteState.isLoading}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </Screen>
  );
}
