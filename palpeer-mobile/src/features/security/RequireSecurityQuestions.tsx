import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import {
  useGetPinStatusQuery,
  useGetSecurityQuestionsQuery,
} from '@/services/api/securityApi';
import { useAppSelector } from '@/store';

/**
 * After PIN is set, require security questions so PIN reset stays available. Blocks the rest
 * of the app until answers are saved.
 */
export function RequireSecurityQuestions() {
  const theme = useTheme();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const pathname = usePathname();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const questions = useGetSecurityQuestionsQuery(undefined, {
    skip: !authenticated || !pinStatus.data?.pinSet,
  });
  const redirected = useRef(false);

  const onQuestions = pathname?.includes('/security/questions') ?? false;
  const onSetPin = pathname?.includes('/security/pin/set') ?? false;
  const needsQuestions =
    authenticated &&
    !locked &&
    !!pinStatus.data?.pinSet &&
    !!questions.data &&
    questions.data.length === 0 &&
    !questions.isLoading &&
    !questions.isFetching &&
    !onSetPin;

  useEffect(() => {
    if (!authenticated || locked) {
      redirected.current = false;
      return;
    }
    if (pinStatus.isLoading || pinStatus.isFetching || !pinStatus.data) return;
    if (!pinStatus.data.pinSet) {
      redirected.current = false;
      return;
    }
    if (questions.isLoading || questions.isFetching || !questions.data) return;
    if (questions.data.length > 0) {
      redirected.current = false;
      return;
    }
    if (onQuestions || onSetPin || redirected.current) return;
    redirected.current = true;
    router.replace({ pathname: '/security/questions', params: { required: '1' } });
  }, [
    authenticated,
    locked,
    onQuestions,
    onSetPin,
    pinStatus.data,
    pinStatus.isFetching,
    pinStatus.isLoading,
    questions.data,
    questions.isFetching,
    questions.isLoading,
  ]);

  if (!needsQuestions || onQuestions) return null;

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]}
      accessibilityViewIsModal
      testID="require-questions-gate"
    >
      <View style={[styles.body, { padding: theme.spacing.xxl, gap: theme.spacing.lg }]}>
        <AppText variant="h3" align="center">
          Set security questions
        </AppText>
        <AppText tone="secondary" align="center">
          Answer a few security questions so you can reset your PIN if you forget it.
        </AppText>
        {questions.isLoading || questions.isFetching ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Button
            label="Continue"
            shape="pill"
            onPress={() => {
              redirected.current = true;
              router.replace({ pathname: '/security/questions', params: { required: '1' } });
            }}
            testID="require-questions-continue"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
