import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { SensitiveScreenGuard } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { authorizedRequest } from '@/services/api/authorized';
import { baseApi } from '@/services/api/baseApi';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '@/services/biometrics/biometrics';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch, useAppSelector } from '@/store';
import type { PinStatusResponse } from '@/types/api/security';

import { PinEntry } from './components/PinEntry';
import { isPinLocked, pinLockedMessage, securityErrorMessage } from './errors';

type PromptOptions = {
  title?: string;
  message?: string;
  /** When true (default), offer Fingerprint / Face ID alongside the PIN pad if enabled. */
  allowBiometric?: boolean;
};
type PinPromptApi = { requestPin: (options?: PromptOptions) => Promise<boolean> };

const PinPromptContext = createContext<PinPromptApi | null>(null);

/**
 * App-wide full-screen "confirm with your PIN" flow. Uses a native Modal so it stacks above
 * expo-router / react-native-screens (JS overlays sit underneath native stack windows).
 * `requestPin` resolves true after POST /security/pin/verify succeeds, or after a successful
 * biometric check when biometric unlock is enabled (client-side step R-SEC-2).
 */
export function PinPromptProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const dispatch = useAppDispatch();
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const [request, setRequest] = useState<PromptOptions | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const biometricAttempted = useRef(false);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
    setError(null);
    setBlocked(false);
    setVerifying(false);
    setBiometricLabel(null);
    biometricAttempted.current = false;
  }, []);

  const requestPin = useCallback((options: PromptOptions = {}) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setError(null);
      setBlocked(false);
      setBiometricLabel(null);
      biometricAttempted.current = false;
      setRequest({ allowBiometric: true, ...options });
    });
  }, []);

  const verify = async (pin: string) => {
    setVerifying(true);
    setError(null);
    const result = await securityCommands.verifyPin({ pin });
    setVerifying(false);
    if (result.ok) {
      finish(true);
      return;
    }
    if (isPinLocked(result.error)) {
      dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
      setBlocked(true);
      const status = await authorizedRequest<PinStatusResponse>('/security/pin');
      setError(pinLockedMessage(status.ok ? status.data.lockedUntil : null));
    } else if (result.error.code === 'RESOURCE_NOT_FOUND') {
      setBlocked(true);
      setError(securityErrorMessage(result.error));
    } else {
      setError(securityErrorMessage(result.error));
    }
  };

  const tryBiometric = useCallback(async () => {
    if (!request || verifying || blocked) return;
    setVerifying(true);
    setError(null);
    const result = await authenticateWithBiometrics(
      request.title ?? 'Confirm with Fingerprint',
    );
    setVerifying(false);
    if (result === 'success') {
      finish(true);
      return;
    }
    if (result === 'cancelled') return;
    if (result === 'lockout') {
      setError('Too many biometric attempts. Enter your PIN instead.');
      return;
    }
    setError('Fingerprint was not recognized. Enter your PIN instead.');
  }, [blocked, finish, request, verifying]);

  useEffect(() => {
    if (!request) return;
    const allow = request.allowBiometric !== false && biometricEnabled;
    if (!allow) {
      setBiometricLabel(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const capability = await getBiometricCapability();
      if (cancelled) return;
      if (capability.status !== 'available') {
        setBiometricLabel(null);
        return;
      }
      setBiometricLabel(capability.label);
      if (!biometricAttempted.current) {
        biometricAttempted.current = true;
        await tryBiometric();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only when a new prompt opens — not on every tryBiometric identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, biometricEnabled]);

  const open = request !== null;

  return (
    <PinPromptContext.Provider value={{ requestPin }}>
      {children}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => {
          if (!verifying) finish(false);
        }}
        testID="pin-prompt"
      >
        {/* Modal content is portaled outside the app tree — needs its own SafeAreaProvider. */}
        <SafeAreaProvider>
          <View style={[styles.fill, { minHeight: windowHeight, backgroundColor: theme.colors.background }]}>
            <SafeAreaView style={styles.fill} edges={['top', 'bottom', 'left', 'right']}>
              {open && request ? (
                <>
                  <SensitiveScreenGuard />
                  <View
                    style={[
                      styles.fill,
                      {
                        paddingHorizontal: theme.spacing.xl,
                        paddingTop: theme.spacing.md,
                      },
                    ]}
                  >
                    <PinEntry
                      title={request.title ?? 'Enter your PIN'}
                      subtitle={request.message}
                      error={error}
                      submitLabel="Confirm"
                      loading={verifying}
                      disabled={blocked}
                      autoSubmit
                      onSubmit={(pin) => void verify(pin)}
                      testID="pin-prompt-entry"
                      footer={
                        <View style={{ gap: theme.spacing.sm }}>
                          {biometricLabel && !blocked ? (
                            <Button
                              label={`Use ${biometricLabel}`}
                              variant="outline"
                              onPress={() => void tryBiometric()}
                              disabled={verifying}
                              testID="pin-prompt-biometric"
                            />
                          ) : null}
                          <Button
                            label={blocked ? 'Close' : 'Cancel'}
                            variant="ghost"
                            onPress={() => finish(false)}
                            disabled={verifying}
                            testID="pin-prompt-cancel"
                          />
                        </View>
                      }
                    />
                  </View>
                </>
              ) : null}
            </SafeAreaView>
          </View>
        </SafeAreaProvider>
      </Modal>
    </PinPromptContext.Provider>
  );
}

export function usePinPrompt(): PinPromptApi {
  const context = useContext(PinPromptContext);
  if (!context) throw new Error('usePinPrompt must be used inside PinPromptProvider');
  return context;
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
});
