import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { SensitiveScreenGuard } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { baseApi } from '@/services/api/baseApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch } from '@/store';

import { PinEntry } from './components/PinEntry';
import { isPinLocked, pinLockedMessage, securityErrorMessage } from './errors';

type PromptOptions = { title?: string; message?: string };
type PinPromptApi = { requestPin: (options?: PromptOptions) => Promise<boolean> };

const PinPromptContext = createContext<PinPromptApi | null>(null);

/**
 * App-wide full-screen "confirm with your PIN" flow. Uses a native Modal so it stacks above
 * expo-router / react-native-screens (JS overlays sit underneath native stack windows).
 * `requestPin` resolves true only after POST /security/pin/verify succeeds.
 */
export function PinPromptProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const dispatch = useAppDispatch();
  const [request, setRequest] = useState<PromptOptions | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
    setError(null);
    setBlocked(false);
    setVerifying(false);
  }, []);

  const requestPin = useCallback((options: PromptOptions = {}) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setError(null);
      setBlocked(false);
      setRequest(options);
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
      setError(pinLockedMessage());
    } else if (result.error.code === 'RESOURCE_NOT_FOUND') {
      setBlocked(true);
      setError(securityErrorMessage(result.error));
    } else {
      setError(securityErrorMessage(result.error));
    }
  };

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
                        <Button
                          label={blocked ? 'Close' : 'Cancel'}
                          variant="ghost"
                          onPress={() => finish(false)}
                          disabled={verifying}
                          testID="pin-prompt-cancel"
                        />
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
