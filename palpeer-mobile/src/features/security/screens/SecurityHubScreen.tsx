import { router } from 'expo-router';
import {
  ChevronRight,
  Fingerprint,
  KeyRound,
  KeySquare,
  LockKeyhole,
  MessageCircleQuestion,
  Smartphone,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, Switch, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { toAppError } from '@/services/api/errors';
import {
  useGetDevicesQuery,
  useGetPinStatusQuery,
  useGetSecurityQuestionsQuery,
} from '@/services/api/securityApi';
import { getBiometricCapability, type BiometricCapability } from '@/services/biometrics/biometrics';
import { useAppDispatch, useAppSelector } from '@/store';
import { biometricChanged } from '@/store/slices/appLockSlice';

import { disableBiometricUnlock, enableBiometricUnlock } from '../biometricUnlock';
import { pinLockedMessage, securityErrorMessage } from '../errors';

export function SecurityHubScreen() {
  const theme = useTheme();
  const pin = useGetPinStatusQuery();
  const questions = useGetSecurityQuestionsQuery();
  const devices = useGetDevicesQuery();

  const refreshing = pin.isFetching || questions.isFetching || devices.isFetching;
  const refresh = () => {
    void pin.refetch();
    void questions.refetch();
    void devices.refetch();
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing && !pin.isLoading}
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <StackHeader title="Security" />

      <Section title="Transaction PIN">
        {pin.data ? (
          <View style={{ gap: theme.spacing.md }}>
            <Row
              icon={KeyRound}
              title="Transaction PIN"
              detail={pin.data.pinSet ? 'Used to confirm sensitive actions' : 'Not set up yet'}
              right={
                <Badge
                  label={pin.data.pinSet ? 'On' : 'Off'}
                  tone={pin.data.pinSet ? 'success' : 'neutral'}
                />
              }
            />
            {pin.data.lockedUntil ? (
              <FormAlert message={pinLockedMessage(pin.data.lockedUntil)} testID="hub-pin-locked" />
            ) : null}
            {pin.data.pinSet ? (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Change PIN"
                    variant="outline"
                    onPress={() => router.push('/security/pin/change')}
                    testID="hub-change-pin"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Forgot PIN"
                    variant="ghost"
                    onPress={() => router.push('/security/pin/forgot')}
                    testID="hub-forgot-pin"
                  />
                </View>
              </View>
            ) : (
              <Button
                label="Set up PIN"
                onPress={() => router.push('/security/pin/set')}
                testID="hub-set-pin"
              />
            )}
          </View>
        ) : pin.error ? (
          <InlineError message={toAppError(pin.error).message} onRetry={() => void pin.refetch()} />
        ) : (
          <Skeleton height={88} />
        )}
      </Section>

      <Section title="Recovery">
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/security/questions')}
          accessibilityLabel="Security questions"
          testID="hub-questions"
        >
          <Row
            icon={MessageCircleQuestion}
            title="Security questions"
            detail={
              questions.data
                ? questions.data.length > 0
                  ? `${questions.data.length} questions set — used to reset your PIN`
                  : 'Not set up — needed to reset your PIN'
                : 'Loading…'
            }
            right={<Icon icon={ChevronRight} color={theme.colors.textMuted} />}
          />
        </Card>
      </Section>

      <Section title="Sign-in">
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/security/password')}
          accessibilityLabel="Change password"
          testID="hub-password"
        >
          <Row
            icon={LockKeyhole}
            title="Password"
            detail="Change the password you sign in with"
            right={<Icon icon={ChevronRight} color={theme.colors.textMuted} />}
          />
        </Card>
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/security/sessions')}
          accessibilityLabel="Active sessions"
          testID="hub-sessions"
        >
          <Row
            icon={KeySquare}
            title="Active sessions"
            detail="See where you're signed in and sign out remotely"
            right={<Icon icon={ChevronRight} color={theme.colors.textMuted} />}
          />
        </Card>
        <BiometricToggle />
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/security/devices')}
          accessibilityLabel="Registered devices"
          testID="hub-devices"
        >
          <Row
            icon={Smartphone}
            title="Registered devices"
            detail={
              devices.data
                ? `${devices.data.length} device${devices.data.length === 1 ? '' : 's'}`
                : 'Loading…'
            }
            right={<Icon icon={ChevronRight} color={theme.colors.textMuted} />}
          />
        </Card>
      </Section>
    </Screen>
  );
}

function BiometricToggle() {
  const theme = useTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.session.userId);
  const enabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((result) => {
      if (active) setCapability(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const label = capability && capability.status !== 'unsupported' ? capability.label : 'Biometrics';
  const available = capability?.status === 'available';

  const toggle = async (next: boolean) => {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    if (next) {
      const outcome = await enableBiometricUnlock(userId, label);
      if (outcome.status === 'enabled') {
        dispatch(biometricChanged(true));
        toast.show({ type: 'success', title: `${label} unlock is on` });
      } else if (outcome.status === 'error') {
        setError(securityErrorMessage(outcome.error));
      } else if (outcome.result === 'lockout') {
        setError(`${label} is locked after too many attempts. Unlock your phone and try again.`);
      } else if (outcome.result !== 'cancelled') {
        setError(`We couldn't confirm ${label}. Try again.`);
      }
    } else {
      const outcome = await disableBiometricUnlock();
      if (outcome.ok) {
        dispatch(biometricChanged(false));
        toast.show({ type: 'info', title: `${label} unlock is off` });
      } else {
        setError(securityErrorMessage(outcome.error));
      }
    }
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'DEVICES' }]));
    setBusy(false);
  };

  const detail = !capability
    ? 'Checking this device…'
    : capability.status === 'unsupported'
      ? 'Not available on this device'
      : capability.status === 'notEnrolled'
        ? `Set up ${label} in your phone settings first`
        : `Unlock the app with ${label} instead of signing in each time`;

  return (
    <Card variant="outlined" padding="md" testID="hub-biometric">
      <View style={{ gap: theme.spacing.sm }}>
        <Row
          icon={Fingerprint}
          title={`${label} unlock`}
          detail={detail}
          right={
            <Switch
              value={enabled}
              onValueChange={(value) => void toggle(value)}
              disabled={busy || (!enabled && !available)}
              accessibilityLabel={`${label} unlock`}
              trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
              testID="hub-biometric-switch"
            />
          }
        />
        <FormAlert message={error} testID="hub-biometric-error" />
      </View>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="overline" tone="muted">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Row({
  icon,
  title,
  detail,
  right,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Icon icon={icon} color={theme.colors.primary} />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {detail}
        </AppText>
      </View>
      {right}
    </View>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <FormAlert message={message} />
      <Button label="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}
