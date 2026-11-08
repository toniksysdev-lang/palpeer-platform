import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIMPLE_HOME as D } from '@/design/simpleHomeTokens';
import {
  useGetPinStatusQuery,
  useGetSecurityQuestionsQuery,
} from '@/services/api/securityApi';
import { useAppSelector } from '@/store';

const QUESTIONS_PATH = '/StartQuestions';

function onQuestionsPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('/StartQuestions') ||
    pathname.includes('/StartPinSet') ||
    pathname.includes('/StartPinAgain') ||
    pathname.includes('/StartBio') ||
    pathname.includes('/security/questions')
  );
}

function onPinSetupPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('/StartPinSet') ||
    pathname.includes('/StartPinAgain') ||
    pathname.includes('/security/pin/set')
  );
}

/**
 * After PIN is set, require security questions so PIN reset stays available. Blocks the rest
 * of the app until answers are saved. Uses the design StartQuestions screen.
 */
export function RequireSecurityQuestions() {
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const pathname = usePathname();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const questions = useGetSecurityQuestionsQuery(undefined, {
    skip: !authenticated || !pinStatus.data?.pinSet,
  });
  const redirected = useRef(false);

  const onQuestions = onQuestionsPath(pathname);
  const onSetPin = onPinSetupPath(pathname);
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
    router.replace({ pathname: QUESTIONS_PATH, params: { setupRequired: '1' } });
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
      style={[StyleSheet.absoluteFill, styles.page]}
      accessibilityViewIsModal
      testID="require-questions-gate"
    >
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">
          My 2 security questions
        </Text>
        <Text style={styles.subtitle}>
          Choose 2 questions only you can answer, so you can reset your PIN if you forget it. Small
          or capital letters do not matter.
        </Text>
        {questions.isLoading || questions.isFetching ? (
          <ActivityIndicator color={D.green} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={() => {
              redirected.current = true;
              router.replace({ pathname: QUESTIONS_PATH, params: { setupRequired: '1' } });
            }}
            testID="require-questions-continue"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.ctaLabel}>Continue</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: D.page },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: D.secondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: D.white,
  },
});
