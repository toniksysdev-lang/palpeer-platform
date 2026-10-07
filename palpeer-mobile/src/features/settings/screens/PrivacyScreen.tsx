import { router } from 'expo-router';
import {
  Bell,
  Camera,
  EyeOff,
  FileText,
  Fingerprint,
  HardDrive,
  Images,
  ScrollText,
  Settings,
  UserX,
} from 'lucide-react-native';
import { Linking } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { NavRow, RowSection } from '@/components/ui/NavRow';
import { appConfig } from '@/config/env';
import { openExternal, supportMailto } from '@/features/support/appInfo';
import { useToast } from '@/providers/ToastProvider';

export function PrivacyScreen() {
  const toast = useToast();
  const { privacyPolicyUrl, termsUrl, email } = appConfig.support;

  const openLink = async (url: string, fallback = "This link couldn't be opened.") => {
    if (!(await openExternal(url))) toast.show({ type: 'error', title: fallback });
  };

  const openSettings = () => {
    Linking.openSettings().catch(() =>
      toast.show({ type: 'error', title: 'Open your phone settings to manage permissions.' }),
    );
  };

  return (
    <Screen scroll>
      <StackHeader title="Privacy" />

      <RowSection title="Policies">
        {privacyPolicyUrl ? (
          <NavRow
            icon={ScrollText}
            title="Privacy policy"
            detail="Opens in your browser"
            onPress={() => void openLink(privacyPolicyUrl)}
            testID="privacy-policy"
          />
        ) : null}
        {termsUrl ? (
          <NavRow
            icon={FileText}
            title="Terms of use"
            detail="Opens in your browser"
            onPress={() => void openLink(termsUrl)}
            testID="privacy-terms"
          />
        ) : null}
        {!privacyPolicyUrl && !termsUrl ? (
          <AppText tone="secondary" testID="privacy-policies-unavailable">
            The privacy policy and terms aren&apos;t available in this version of the app yet.
          </AppText>
        ) : null}
      </RowSection>

      <RowSection title="What the app can access">
        <NavRow
          icon={Camera}
          title="Camera"
          detail="Only to photograph your identity document and selfie for verification."
        />
        <NavRow
          icon={Images}
          title="Photos"
          detail="Only when you choose a document photo from your library."
        />
        <NavRow
          icon={Fingerprint}
          title="Face ID or fingerprint"
          detail="Only to unlock the app, and only if you turn it on in Security."
        />
        <NavRow
          icon={Bell}
          title="Notifications"
          detail="Only if you turn them on."
          onPress={() => router.push('/notifications/settings')}
          testID="privacy-notifications"
        />
        <AppText variant="caption" tone="muted">
          PALPEER doesn&apos;t use your location, contacts or microphone. The app asks for each
          permission only when you use the feature that needs it.
        </AppText>
        <Button
          label="Manage permissions in phone settings"
          variant="outline"
          leftIcon={Settings}
          onPress={openSettings}
          testID="privacy-open-settings"
        />
      </RowSection>

      <RowSection title="On this phone">
        <NavRow
          icon={HardDrive}
          title="Your sign-in"
          detail="Kept in the phone's secure storage and removed when you sign out."
        />
        <NavRow
          icon={EyeOff}
          title="Screen protection"
          detail="The screens for setting, changing or resetting your PIN, changing your password, setting security answers and photographing your ID block screenshots and screen recording."
        />
      </RowSection>

      <RowSection title="Your account">
        <NavRow
          icon={UserX}
          title="Delete your account"
          detail={
            email
              ? "This can't be done in the app yet. Email support to request it."
              : "This can't be done in the app yet. Contact support to request it."
          }
          destructive
          onPress={
            email
              ? () =>
                  void openLink(
                    supportMailto(email, 'Account deletion request'),
                    `No email app found. Write to ${email}.`,
                  )
              : undefined
          }
          testID="privacy-delete-account"
        />
      </RowSection>
    </Screen>
  );
}
