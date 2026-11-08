import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { useAppSelector } from '@/store';

const PIN_SETUP_PATH = '/StartPinSet';

function onPinSetupPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('/StartPinSet') ||
    pathname.includes('/StartPinAgain') ||
    pathname.includes('/security/pin/set')
  );
}

/**
 * After login, block the app until a transaction PIN is set. Redirects to the design
 * StartPinSet screen and covers the UI so tabs / money screens are not usable in the meantime.
 */
export function RequirePinSetup() {
  const theme = useTheme();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const pathname = usePathname();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const redirected = useRef(false);

  const onSetPin = onPinSetupPath(pathname);
  const needsPin =
    authenticated &&
    !locked &&
    !!pinStatus.data &&
    !pinStatus.data.pinSet &&
    !pinStatus.isLoading &&
    !pinStatus.isFetching;

  useEffect(() => {
    if (!authenticated || locked) {
      redirected.current = false;
      return;
    }
    if (pinStatus.isLoading || pinStatus.isFetching || !pinStatus.data) return;
    if (pinStatus.data.pinSet) {
      redirected.current = false;
      return;
    }
    if (onSetPin || redirected.current) return;
    redirected.current = true;
    router.replace({ pathname: PIN_SETUP_PATH, params: { setupRequired: '1' } });
  }, [
    authenticated,
    locked,
    onSetPin,
    pinStatus.data,
    pinStatus.isFetching,
    pinStatus.isLoading,
  ]);

  if (!needsPin || onSetPin) return null;

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]}
      accessibilityViewIsModal
      testID="require-pin-gate"
    >
      <View style={[styles.body, { padding: theme.spacing.xxl, gap: theme.spacing.lg }]}>
        <AppText variant="h3" align="center">
          Set up your PIN
        </AppText>
        <AppText tone="secondary" align="center">
          Create a 4-digit transaction PIN before using Palpeer. You&apos;ll need it to confirm
          transfers and withdrawals.
        </AppText>
        {pinStatus.isLoading || pinStatus.isFetching ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Button
            label="Continue"
            shape="pill"
            onPress={() => {
              redirected.current = true;
              router.replace({ pathname: PIN_SETUP_PATH, params: { setupRequired: '1' } });
            }}
            testID="require-pin-continue"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
