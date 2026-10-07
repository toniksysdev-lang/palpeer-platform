import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

import { NumberPadProvider } from '@/components/ui/NumberPadContext';
import { PinPromptProvider } from '@/features/security/PinPromptProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { createStore, type AppStore } from '@/store';
import { preferencesLoaded, type AppearancePreference } from '@/store/slices/preferencesSlice';

type Options = Omit<RenderOptions, 'wrapper'> & {
  appearance?: AppearancePreference;
  /** Runs against the store before the first render. */
  prepareStore?: (store: AppStore) => void;
};

export async function renderWithProviders(
  ui: ReactElement,
  { appearance = 'light', prepareStore, ...options }: Options = {},
) {
  const store = createStore();
  store.dispatch(
    preferencesLoaded({ appearance, onboardingSeen: true, biometricUnlockPrompted: true }),
  );
  prepareStore?.(store);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <ThemeProvider>
            <ToastProvider>
              <NumberPadProvider>
                <PinPromptProvider>{children}</PinPromptProvider>
              </NumberPadProvider>
            </ToastProvider>
          </ThemeProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    );
  }

  const result = await render(ui, { wrapper: Wrapper, ...options });
  return { store, ...result };
}
