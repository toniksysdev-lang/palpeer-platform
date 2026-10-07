import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';

import { canUseGoogleSignIn } from '../googleAvailability';

type Props = {
  testID?: string;
};

/**
 * Divider + Continue with Google. Hidden when client IDs are unset or the native
 * ExpoWebBrowser module is missing (APK needs rebuild after adding expo-web-browser).
 */
export function GoogleSignInSection({ testID = 'google-sign-in' }: Props) {
  const theme = useTheme();

  if (!canUseGoogleSignIn()) return null;

  // Load the hook only when the native module exists so Login/Register still mount.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGoogleSignIn } = require('../hooks/useGoogleSignIn') as typeof import('../hooks/useGoogleSignIn');
  // Hooks must be called unconditionally — this branch only runs when native is present,
  // and this component remounts after a rebuild. Use a child to satisfy the rules of hooks.
  return <GoogleSignInSectionReady testID={testID} useGoogleSignIn={useGoogleSignIn} />;
}

function GoogleSignInSectionReady({
  testID,
  useGoogleSignIn,
}: {
  testID: string;
  useGoogleSignIn: typeof import('../hooks/useGoogleSignIn').useGoogleSignIn;
}) {
  const theme = useTheme();
  const google = useGoogleSignIn();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={styles.dividerRow}>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <AppText tone="secondary" style={{ paddingHorizontal: theme.spacing.sm }}>
          or
        </AppText>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
      </View>
      <Button
        label="Continue with Google"
        loadingLabel="Signing in…"
        variant="outline"
        shape="pill"
        onPress={google.signIn}
        loading={google.busy}
        disabled={!google.ready}
        testID={testID}
      />
      {google.error ? (
        <AppText tone="danger" style={{ textAlign: 'center' }} testID={`${testID}-error`}>
          {google.error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
