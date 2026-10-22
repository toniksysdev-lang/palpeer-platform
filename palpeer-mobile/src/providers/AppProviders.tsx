import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

import { NumberPadProvider } from '@/components/ui/NumberPadContext';
import { PinPromptProvider } from '@/features/security/PinPromptProvider';
import { store } from '@/store';

import { ErrorBoundary } from './ErrorBoundary';
import { NetworkProvider } from './NetworkProvider';
import { PushNotificationsProvider } from './PushNotificationsProvider';
import { RealtimeProvider } from './RealtimeProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <ReduxProvider store={store}>
            <NetworkProvider>
              <RealtimeProvider>
                <ThemeProvider>
                  <ToastProvider>
                    <NumberPadProvider>
                      <PushNotificationsProvider>
                        <PinPromptProvider>{children}</PinPromptProvider>
                      </PushNotificationsProvider>
                    </NumberPadProvider>
                  </ToastProvider>
                </ThemeProvider>
              </RealtimeProvider>
            </NetworkProvider>
          </ReduxProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  // Match BrandSplash / boot HTML so the provider shell never flashes a foreign color.
  root: { flex: 1, backgroundColor: '#FFFFFF' },
});
