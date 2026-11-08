import { router } from 'expo-router';
import { ChevronLeft, Fingerprint, Volume2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIMPLE_HOME as D } from '@/design/simpleHomeTokens';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { getBiometricCapability, type BiometricCapability } from '@/services/biometrics/biometrics';
import { useAppDispatch, useAppSelector } from '@/store';
import { biometricChanged } from '@/store/slices/appLockSlice';

import { disableBiometricUnlock, enableBiometricUnlock } from '../biometricUnlock';
import { securityErrorMessage } from '../errors';

/**
 * Settings → Face or Fingerprint — turn app unlock with biometrics on or off.
 * Matches the Simple Home sheet chrome (Back + Listen + white rows).
 */
export function BiometricSettingsScreen() {
  const toast = useToast();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.session.userId);
  const enabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((result) => {
      if (active) setCapability(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const label =
    capability && capability.status !== 'unsupported' ? capability.label : 'Face or Fingerprint';
  const available = capability?.status === 'available';

  const detail = !capability
    ? 'Checking this device…'
    : capability.status === 'unsupported'
      ? 'Not available on this device'
      : capability.status === 'notEnrolled'
        ? `Set up ${label} in your phone settings first`
        : enabled
          ? `On. Unlock the app with ${label} after idle logout.`
          : `Off. Turn on to unlock with ${label} instead of signing in each time.`;

  const toggle = async (next: boolean) => {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    if (next) {
      const outcome = await enableBiometricUnlock(userId, label);
      if (outcome.status === 'enabled') {
        dispatch(biometricChanged(true));
        toast.show({ type: 'success', title: `${label} unlock is on` });
      } else if (outcome.status === 'error') {
        setError(securityErrorMessage(outcome.error));
      } else if (outcome.result === 'lockout') {
        setError(`${label} is locked after too many attempts. Unlock your phone and try again.`);
      } else if (outcome.result !== 'cancelled') {
        setError(`We couldn't confirm ${label}. Try again.`);
      }
    } else {
      const outcome = await disableBiometricUnlock();
      if (outcome.ok) {
        dispatch(biometricChanged(false));
        toast.show({ type: 'info', title: `${label} unlock is off` });
      } else {
        setError(securityErrorMessage(outcome.error));
      }
    }
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'DEVICES' }]));
    setBusy(false);
  };

  const onListen = () => {
    try {
      const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
      if (!synth) return;
      if (speaking) {
        synth.cancel();
        setSpeaking(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(
        `Face or Fingerprint. ${label} unlock. ${enabled ? 'On.' : 'Off.'} ${detail}`,
      );
      u.lang = 'en-NG';
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(u);
    } catch {
      setSpeaking(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/More');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="biometric-settings-screen">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          style={({ pressed }) => [styles.pill, styles.backPill, pressed && styles.pressed]}
        >
          <ChevronLeft color={D.ink} size={22} strokeWidth={2.6} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? 'Stop listening' : 'Listen to this screen'}
          onPress={onListen}
          style={({ pressed }) => [styles.pill, styles.listenPill, pressed && styles.pressed]}
        >
          <Volume2 color={D.white} size={20} strokeWidth={2.2} />
          <Text style={styles.listenLabel}>{speaking ? 'Stop' : 'Listen'}</Text>
        </Pressable>
      </View>

      <Text style={styles.title} accessibilityRole="header">
        Face or Fingerprint
      </Text>
      <Text style={styles.subtitle}>Open the app with my face or finger.</Text>

      <View
        style={[styles.row, enabled && styles.rowOn]}
        testID="biometric-settings-row"
        accessibilityLabel={`${label} unlock`}
      >
        <View style={styles.rowIcon}>
          <Fingerprint color={D.green} size={28} strokeWidth={2.4} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{`${label} unlock`}</Text>
          <Text style={styles.rowNote}>{detail}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={(value) => void toggle(value)}
          disabled={busy || (!enabled && !available)}
          accessibilityLabel={`${label} unlock`}
          trackColor={{ true: D.green, false: D.border }}
          testID="biometric-settings-switch"
        />
      </View>

      {error ? (
        <Text style={styles.error} testID="biometric-settings-error" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: D.page,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
  },
  pill: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  backPill: {
    backgroundColor: D.white,
    paddingLeft: 10,
  },
  listenPill: {
    backgroundColor: D.ink,
    paddingLeft: 12,
  },
  pressed: { opacity: 0.88 },
  backLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '700',
    color: D.ink,
  },
  listenLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '700',
    color: D.white,
  },
  title: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 30,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 34,
    paddingBottom: 6,
  },
  subtitle: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '600',
    color: D.secondary,
    lineHeight: 22,
    paddingBottom: 14,
  },
  row: {
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: D.white,
    borderWidth: 3,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowOn: {
    borderColor: D.green,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: D.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 20,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 24,
  },
  rowNote: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '600',
    color: D.body,
    lineHeight: 21,
  },
  error: {
    marginTop: 12,
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '700',
    color: D.danger,
    lineHeight: 22,
  },
});
