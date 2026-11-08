import { router, type Href } from 'expo-router';
import { Bell, Fingerprint, Info, LifeBuoy, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { Button } from '@/components/ui/Button';
import { NavRow, RowSection } from '@/components/ui/NavRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { appVersion } from '@/features/support/appInfo';
import { useAppearance } from '@/hooks/useAppearance';
import { useT } from '@/i18n/useT';
import { useToast } from '@/providers/ToastProvider';
import { sessionManager } from '@/services/auth/session';
import { getBiometricCapability } from '@/services/biometrics/biometrics';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppSelector } from '@/store';
import type { AppearancePreference } from '@/store/slices/preferencesSlice';

/** App look: Light / Dark (design). System kept as an advanced option. */
const APP_LOOK_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const satisfies readonly { value: AppearancePreference; label: string }[];

export function SettingsScreen() {
  const { appearance, setAppearance } = useAppearance();
  const t = useT();
  const toast = useToast();
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const biometricUserId = await secureStorage.getBiometricUserId();
    const stored = await secureStorage.loadSession();
    if (biometricEnabled && biometricUserId && stored && biometricUserId === stored.userId) {
      await sessionManager.dismissToLogin();
      const capability = await getBiometricCapability();
      const label =
        capability.status === 'available' || capability.status === 'notEnrolled'
          ? capability.label
          : 'Face ID or Fingerprint';
      toast.show({
        type: 'info',
        title: `Signed out — use ${label} on Log in`,
        message: 'Or sign in again with your password.',
      });
      return;
    }
    await sessionManager.signOut();
  };

  return (
    <Screen scroll>
      <StackHeader title={t('settings.title')} />

      <RowSection title={t('settings.appLook')}>
        <SegmentedControl
          options={APP_LOOK_OPTIONS}
          value={appearance}
          onChange={setAppearance}
          accessibilityLabel={t('settings.appLook')}
        />
      </RowSection>

      <RowSection title="Preferences">
        <NavRow
          icon={Bell}
          title={t('more.alerts')}
          detail="Push notifications on this phone and your other devices"
          onPress={() => router.push('/notifications/settings')}
          testID="settings-notifications"
        />
        <NavRow
          icon={Fingerprint}
          title="Face or Fingerprint"
          detail="Open the app with my face or finger"
          onPress={() => router.push('/security/biometrics' as Href)}
          testID="settings-biometrics"
        />
        <NavRow
          icon={LockKeyhole}
          title={t('more.staySafe')}
          detail="My PIN, password, fingerprint, signed-in phones"
          onPress={() => router.push('/security')}
          testID="settings-security"
        />
        <NavRow
          icon={ShieldCheck}
          title={t('more.privacy')}
          detail="Permissions, policies and your data"
          onPress={() => router.push('/settings/privacy')}
          testID="settings-privacy"
        />
      </RowSection>

      <RowSection title="About">
        <NavRow
          icon={LifeBuoy}
          title={t('more.getHelp')}
          onPress={() => router.push('/support')}
          testID="settings-support"
        />
        <NavRow
          icon={Info}
          title="App version"
          detail={appVersion() ?? '—'}
          testID="settings-version"
        />
      </RowSection>

      <Button
        label={t('settings.signOut')}
        variant="outline"
        leftIcon={LogOut}
        onPress={() => setConfirming(true)}
        testID="settings-sign-out"
      />
      <ConfirmDialog
        visible={confirming}
        title="Sign out?"
        message={
          biometricEnabled
            ? 'You can sign back in with Face ID or Fingerprint on Log in, or use your password.'
            : "You'll need your email and password to sign in again."
        }
        confirmLabel={t('settings.signOut')}
        destructive
        loading={signingOut}
        onConfirm={signOut}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
