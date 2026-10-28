import { router } from 'expo-router';
import { Bell, Info, LifeBuoy, LockKeyhole, ShieldCheck } from 'lucide-react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { NavRow, RowSection } from '@/components/ui/NavRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { appVersion } from '@/features/support/appInfo';
import { useAppearance } from '@/hooks/useAppearance';
import type { AppearancePreference } from '@/store/slices/preferencesSlice';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: AppearancePreference; label: string }[];

export function SettingsScreen() {
  const { appearance, setAppearance } = useAppearance();

  return (
    <Screen scroll>
      <StackHeader title="Settings" />

      <RowSection title="Appearance">
        <SegmentedControl
          options={APPEARANCE_OPTIONS}
          value={appearance}
          onChange={setAppearance}
          accessibilityLabel="Appearance"
        />
      </RowSection>

      <RowSection title="Preferences">
        <NavRow
          icon={Bell}
          title="Notifications"
          detail="Push notifications on this phone and your other devices"
          onPress={() => router.push('/notifications/settings')}
          testID="settings-notifications"
        />
        <NavRow
          icon={LockKeyhole}
          title="Security"
          detail="Password, transaction PIN, biometric unlock, sessions"
          onPress={() => router.push('/security')}
          testID="settings-security"
        />
        <NavRow
          icon={ShieldCheck}
          title="Privacy"
          detail="Permissions, policies and your data"
          onPress={() => router.push('/settings/privacy')}
          testID="settings-privacy"
        />
      </RowSection>

      <RowSection title="About">
        <NavRow
          icon={LifeBuoy}
          title="Help & support"
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
    </Screen>
  );
}
