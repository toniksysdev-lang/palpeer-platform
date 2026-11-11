import { router, type Href } from 'expo-router';
import { Linking } from 'react-native';
import { Btn, Card, Choice, H1, P, Screen, TopBar, Txt } from '@/newui/ui/kit';

type Props = {
  backend?: boolean;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  supportEmail?: string | null;
  onOpenUrl?: (url: string, fallback?: string) => void | Promise<void>;
  onOpenNotifications?: () => void;
  onDeleteAccount?: () => void | Promise<void>;
  onBack?: () => void;
};

/** Privacy — policies, permissions, account. */
export default function Privacy(props: Props) {
  const back = () => {
    if (props.onBack) props.onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/More' as Href);
  };

  const openSettings = () => {
    Linking.openSettings().catch(() => undefined);
  };

  return (
    <Screen scroll gap={12}>
      <TopBar onBack={back} say="Privacy. Policies, what the app can access, and your account." />
      <H1>Privacy</H1>

      <Txt size={18} w="800">
        Policies
      </Txt>
      {props.privacyPolicyUrl ? (
        <Choice
          title="Privacy policy"
          note="Opens in your browser"
          onPress={() => void props.onOpenUrl?.(props.privacyPolicyUrl!)}
          right={null}
        />
      ) : null}
      {props.termsUrl ? (
        <Choice
          title="Terms of use"
          note="Opens in your browser"
          onPress={() => void props.onOpenUrl?.(props.termsUrl!)}
          right={null}
        />
      ) : null}
      {!props.privacyPolicyUrl && !props.termsUrl ? (
        <Card>
          <Txt size={16} color="text2">
            The privacy policy and terms are not available in this version yet.
          </Txt>
        </Card>
      ) : null}

      <Txt size={18} w="800">
        What the app can access
      </Txt>
      <Choice
        title="Camera"
        note="Only to photograph your identity document and selfie for verification."
        onPress={() => {}}
        right={null}
      />
      <Choice
        title="Photos"
        note="Only when you choose a document photo from your library."
        onPress={() => {}}
        right={null}
      />
      <Choice
        title="Face ID or fingerprint"
        note="Only to unlock the app, and only if you turn it on in Stay safe."
        onPress={() => {}}
        right={null}
      />
      <Choice
        title="Notifications"
        note="Only if you turn them on."
        onPress={() => props.onOpenNotifications?.()}
        right={null}
      />
      <P>Palpeer does not use your location, contacts or microphone.</P>
      <Btn kind="outline" size="mid" label="Manage permissions in phone settings" onPress={openSettings} />

      <Txt size={18} w="800">
        On this phone
      </Txt>
      <Choice
        title="Your sign-in"
        note="Kept in the phone's secure storage and removed when you sign out."
        onPress={() => {}}
        right={null}
      />
      <Choice
        title="Screen protection"
        note="PIN, password and ID screens block screenshots and screen recording."
        onPress={() => {}}
        right={null}
      />

      <Txt size={18} w="800">
        Your account
      </Txt>
      <Choice
        title="Delete your account"
        note={
          props.supportEmail
            ? "This can't be done in the app yet. Email support to request it."
            : "This can't be done in the app yet. Contact support to request it."
        }
        onPress={() => {
          if (props.supportEmail) void props.onDeleteAccount?.();
        }}
        right={null}
      />
    </Screen>
  );
}
