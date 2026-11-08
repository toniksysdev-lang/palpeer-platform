import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { useGetKycStatusQuery } from '@/services/api/kycApi';
import {
  useGetPinStatusQuery,
  useGetSecurityQuestionsQuery,
} from '@/services/api/securityApi';
import { useAppSelector } from '@/store';

const PROFILE_HOME = '/StartHomeCad';
const PROFILE_DETAILS = '/StartDetails';
const KYC_START = '/StartIdChoose';
const INK = '#0E1F19';
const MUTED = '#33453D';
const GREEN = '#0B6E4F';
const SCRIM = 'rgba(14,31,25,0.55)';

/** Design routes that are part of first-login profile + KYC. */
function onProfileOrKycPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('/StartHomeCad') ||
    pathname.includes('/StartHomeNgn') ||
    pathname.includes('/StartDetails') ||
    pathname.includes('/StartWhere') ||
    pathname.includes('/StartMoney') ||
    pathname.includes('/StartIdChoose') ||
    pathname.includes('/StartKyc') ||
    pathname.includes('/StartChecking') ||
    pathname.includes('/StartVerified') ||
    pathname.includes('/StartKycFail') ||
    pathname.includes('/StartKycStop') ||
    pathname.includes('/StartBioFail') ||
    pathname.includes('/profile') ||
    pathname.includes('/kyc')
  );
}

function onSecuritySetupPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('/StartPinSet') ||
    pathname.includes('/StartPinAgain') ||
    pathname.includes('/StartBio') ||
    pathname.includes('/StartQuestions') ||
    pathname.includes('/StartMethod') ||
    pathname.includes('/ConfirmPin') ||
    pathname.includes('/security/')
  );
}

/** Only force the wizard when the person opens money / main app surfaces. */
function onProtectedAppPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  if (onProfileOrKycPath(pathname) || onSecuritySetupPath(pathname)) return false;
  return (
    pathname.includes('/Main') ||
    pathname.includes('(tabs)') ||
    pathname.includes('/Wallets') ||
    pathname.includes('/wallet') ||
    pathname.includes('/Send') ||
    pathname.includes('/Change') ||
    pathname.includes('/TakeOut') ||
    pathname.includes('/Add') ||
    pathname.includes('/People') ||
    pathname.includes('/exchange') ||
    pathname.includes('/p2p')
  );
}

type GateSheetProps = {
  testID: string;
  title: string;
  body: string;
  actionLabel: string;
  actionTestID: string;
  busy?: boolean;
  onAction: () => void;
};

/** Bottom sheet matching StartGate / design Complete my profile first. */
function DesignGateSheet({
  testID,
  title,
  body,
  actionLabel,
  actionTestID,
  busy,
  onAction,
}: GateSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.scrim]}
      accessibilityViewIsModal
      testID={testID}
    >
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        {busy ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 8 }} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            testID={actionTestID}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaLabel}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * After PIN + security questions, send first-time users through the design
 * Complete my profile → Show my ID (KYC) flow before the main app.
 */
export function RequireProfileSetup() {
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const pathname = usePathname();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const questions = useGetSecurityQuestionsQuery(undefined, {
    skip: !authenticated || !pinStatus.data?.pinSet,
  });
  const { profile, loading: profileLoading } = useEnsureProfile();
  const kyc = useGetKycStatusQuery(undefined, {
    skip: !authenticated || !profile?.complete,
  });
  const redirected = useRef(false);

  const onFlow = onProfileOrKycPath(pathname);
  const onSecurity = onSecuritySetupPath(pathname);
  const onProtected = onProtectedAppPath(pathname);
  const securityReady =
    !!pinStatus.data?.pinSet && !!questions.data && questions.data.length > 0;
  const profileIncomplete = !!profile && !profile.complete;
  const needsKyc =
    !!profile?.complete &&
    !!kyc.data &&
    (kyc.data.status === 'NOT_STARTED' ||
      kyc.data.status === 'IN_PROGRESS' ||
      kyc.data.status === 'REJECTED');

  const needsProfileGate =
    authenticated &&
    !locked &&
    securityReady &&
    !onSecurity &&
    !profileLoading &&
    profileIncomplete &&
    onProtected;

  const needsKycGate =
    authenticated &&
    !locked &&
    securityReady &&
    !onSecurity &&
    !profileLoading &&
    !profileIncomplete &&
    needsKyc &&
    !kyc.isLoading &&
    !kyc.isFetching &&
    onProtected;

  useEffect(() => {
    if (!authenticated || locked) {
      redirected.current = false;
      return;
    }
    if (!securityReady || onSecurity || onFlow || !onProtected || redirected.current) return;
    if (profileLoading || !profile) return;

    if (!profile.complete) {
      redirected.current = true;
      router.replace({ pathname: PROFILE_HOME, params: { gate: '1' } });
      return;
    }

    if (kyc.isLoading || kyc.isFetching || !kyc.data) return;
    if (
      kyc.data.status === 'NOT_STARTED' ||
      kyc.data.status === 'IN_PROGRESS' ||
      kyc.data.status === 'REJECTED'
    ) {
      redirected.current = true;
      router.replace(KYC_START);
    }
  }, [
    authenticated,
    locked,
    securityReady,
    onSecurity,
    onFlow,
    onProtected,
    profileLoading,
    profile,
    kyc.data,
    kyc.isFetching,
    kyc.isLoading,
  ]);

  if (needsProfileGate) {
    return (
      <DesignGateSheet
        testID="require-profile-gate"
        title="Complete my profile first"
        body="I can move money and add wallets after Palpeer checks my details and ID."
        actionLabel="Complete my profile"
        actionTestID="require-profile-continue"
        busy={profileLoading}
        onAction={() => {
          redirected.current = true;
          router.replace({ pathname: PROFILE_DETAILS, params: { setupRequired: '1' } });
        }}
      />
    );
  }

  if (needsKycGate) {
    return (
      <DesignGateSheet
        testID="require-kyc-gate"
        title="Show my ID"
        body="Palpeer needs a photo of your ID and a live photo of your face."
        actionLabel="Continue"
        actionTestID="require-kyc-continue"
        busy={kyc.isLoading || kyc.isFetching}
        onAction={() => {
          redirected.current = true;
          router.replace(KYC_START);
        }}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: SCRIM,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: INK,
    lineHeight: 34,
  },
  body: {
    fontSize: 18,
    fontWeight: '600',
    color: MUTED,
    lineHeight: 24,
  },
  cta: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
