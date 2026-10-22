import { router } from 'expo-router';
import {
  Bell,
  CreditCard,
  Gift,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Megaphone,
  MessageCircle,
  Settings,
  ShieldCheck,
  ShieldHalf,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { NavRow, RowSection } from '@/components/ui/NavRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useGetKycStatusQuery } from '@/services/api/kycApi';
import { sessionManager } from '@/services/auth/session';
import { getBiometricCapability } from '@/services/biometrics/biometrics';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppSelector } from '@/store';

import { useEnsureProfile } from './useEnsureProfile';

export function ProfileScreen() {
  const theme = useTheme();
  const toast = useToast();
  const email = useAppSelector((state) => state.session.email);
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const { profile, loading, error, retry } = useEnsureProfile();
  const kyc = useGetKycStatusQuery();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    // Keep the refresh session when fingerprint unlock is set up so Login can offer it.
    const biometricUserId = await secureStorage.getBiometricUserId();
    const stored = await secureStorage.loadSession();
    if (biometricEnabled && biometricUserId && stored && biometricUserId === stored.userId) {
      await sessionManager.dismissToLogin();
      const capability = await getBiometricCapability();
      const label =
        capability.status === 'available' || capability.status === 'notEnrolled'
          ? capability.label
          : 'Fingerprint';
      toast.show({
        type: 'info',
        title: `Signed out — use ${label} on Login`,
        message: 'Or sign in again with your password.',
      });
      return;
    }
    await sessionManager.signOut();
  };

  return (
    <Screen scroll>
      <StackHeader title="Profile" />

      <Card testID="profile-card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={UserRound} size="lg" color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="overline" tone="muted">
              Email
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} testID="profile-email">
              {email ?? '—'}
            </AppText>
          </View>
        </View>
      </Card>

      {loading ? (
        <Skeleton height={48} testID="profile-loading" />
      ) : error ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FormAlert message={error.message} testID="profile-error" />
          <Button label="Try again" variant="outline" onPress={retry} testID="profile-retry" />
        </View>
      ) : null}

      <RowSection title="Account">
        <NavRow
          icon={UserRound}
          title="Personal information"
          detail={
            profile?.complete
              ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Completed'
              : 'Complete your details to continue'
          }
          right={
            profile && !profile.complete ? (
              <StatusBadge status="PENDING" testID="profile-personal-incomplete" />
            ) : null
          }
          onPress={() => router.push('/profile/personal')}
          testID="profile-personal"
        />
        <NavRow
          icon={ShieldCheck}
          title="Identity verification"
          detail={
            kyc.data?.status === 'APPROVED'
              ? 'Verified'
              : kyc.data?.status === 'REJECTED'
                ? 'Action needed'
                : 'Verify your identity'
          }
          right={
            kyc.data ? <StatusBadge status={kyc.data.status} testID="profile-kyc-status" /> : null
          }
          onPress={() => router.push('/kyc')}
          testID="profile-kyc"
        />
        <NavRow
          icon={LockKeyhole}
          title="Security"
          detail="Password, transaction PIN, biometric unlock, sessions"
          onPress={() => router.push('/security')}
          testID="profile-security"
        />
        <NavRow
          icon={CreditCard}
          title="Cards"
          detail="Virtual cards: issue, freeze, transactions"
          onPress={() => router.push('/cards')}
          testID="profile-cards"
        />
      </RowSection>

      <RowSection title="Rewards">
        <NavRow
          icon={Gift}
          title="Invite friends"
          detail="Your referral code and invites"
          onPress={() => router.push('/referrals')}
          testID="profile-referrals"
        />
        <NavRow
          icon={Wallet}
          title="My bonuses"
          detail="Totals by wallet, unused and used bonuses"
          onPress={() => router.push('/referrals/bonuses')}
          testID="profile-bonuses"
        />
        <NavRow
          icon={Megaphone}
          title="Promotions"
          onPress={() => router.push('/promotions')}
          testID="profile-promotions"
        />
      </RowSection>

      <RowSection title="Preferences">
        <NavRow
          icon={Bell}
          title="Notifications"
          detail="Push notifications on this phone and your other devices"
          onPress={() => router.push('/notifications/settings')}
          testID="profile-notifications"
        />
        <NavRow
          icon={ShieldHalf}
          title="Privacy"
          detail="Permissions, policies and your data"
          onPress={() => router.push('/settings/privacy')}
          testID="profile-privacy"
        />
        <NavRow
          icon={Settings}
          title="Settings"
          detail="Appearance and app version"
          onPress={() => router.push('/settings')}
          testID="profile-settings"
        />
      </RowSection>

      <RowSection title="Help">
        <NavRow
          icon={MessageCircle}
          title="Live chat"
          detail="AI assistant — connect to a live agent when needed"
          onPress={() => router.push('/support/live-chat')}
          testID="profile-live-chat"
        />
        <NavRow
          icon={LifeBuoy}
          title="Help & support"
          detail="Answers to common questions and how to reach us"
          onPress={() => router.push('/support')}
          testID="profile-support"
        />
      </RowSection>

      <Button
        label="Sign out"
        variant="outline"
        leftIcon={LogOut}
        onPress={() => setConfirming(true)}
        testID="profile-sign-out"
      />
      <ConfirmDialog
        visible={confirming}
        title="Sign out?"
        message={
          biometricEnabled
            ? 'You can sign back in with fingerprint or Face ID on the Login screen, or use your password.'
            : "You'll need your email and password to sign in again."
        }
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
        onConfirm={signOut}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
