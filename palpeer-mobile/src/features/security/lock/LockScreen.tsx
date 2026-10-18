import { Fingerprint, LockKeyhole } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { sessionManager } from '@/services/auth/session';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '@/services/biometrics/biometrics';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { appUnlocked } from '@/store/slices/appLockSlice';

import { checkDeviceTrust } from '../biometricUnlock';

/**
 * Full-screen overlay while the app is locked. The navigation state underneath is kept, so
 * unlocking returns the user to where they were.
 */
export function LockScreen() {
  const theme = useTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const email = useAppSelector((state) => state.session.email);
  const [label, setLabel] = useState('Biometrics');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoPrompted = useRef(false);

  const signInWithPassword = useCallback(async () => {
    setBusy(true);
    // Keep the refresh token + biometric binding so Login can offer fingerprint sign-in.
    await sessionManager.dismissToLogin();
  }, []);

  const unlock = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const result = await authenticateWithBiometrics('Unlock PALPEER');
    if (result !== 'success') {
      setBusy(false);
      if (result === 'lockout') {
        setMessage('Biometrics are locked after too many attempts. Sign in with your password.');
      } else if (result === 'unavailable') {
        setMessage(`${label} isn't available right now. Sign in with your password.`);
      } else if (result === 'failed') {
        setMessage("We couldn't confirm it's you. Try again or sign in with your password.");
      }
      return;
    }
    const trust = await checkDeviceTrust();
    if (trust === 'revoked') {
      await secureStorage.setBiometricUserId(null);
      toast.show({
        type: 'warning',
        title: 'Biometric unlock was turned off for this device',
        message: 'Sign in with your password to continue.',
      });
      await sessionManager.signOut();
      return;
    }
    setBusy(false);
    dispatch(appUnlocked());
  }, [dispatch, label, toast]);

  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((capability) => {
      if (!active) return;
      if (capability.status !== 'unsupported') setLabel(capability.label);
      if (!autoPrompted.current) {
        autoPrompted.current = true;
        void unlock();
      }
    });
    return () => {
      active = false;
    };
  }, [unlock]);

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]}
      accessibilityViewIsModal
      testID="lock-screen"
    >
      <View style={[styles.body, { padding: theme.spacing.xxl, gap: theme.spacing.lg }]}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={LockKeyhole} size="xl" color={theme.colors.primary} />
        </View>
        <AppText variant="h1" align="center" accessibilityRole="header">
          PALPEER is locked
        </AppText>
        {email ? (
          <AppText tone="secondary" align="center">
            {email}
          </AppText>
        ) : null}
        <FormAlert tone="warning" message={message} testID="lock-message" />
      </View>
      <View style={{ padding: theme.spacing.xxl, gap: theme.spacing.sm }}>
        <Button
          label={`Unlock with ${label}`}
          leftIcon={Fingerprint}
          onPress={() => void unlock()}
          loading={busy}
          testID="lock-unlock"
        />
        <Button
          label="Sign in with password"
          variant="ghost"
          onPress={() => void signInWithPassword()}
          disabled={busy}
          testID="lock-use-password"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
