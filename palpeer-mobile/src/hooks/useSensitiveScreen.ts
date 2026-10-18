import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useId } from 'react';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';

/**
 * Blocks screenshots and screen recording (and hides the Android recents thumbnail) while the
 * caller is mounted. Each caller gets its own key: with a shared key, closing one protected screen
 * would re-allow capture while another protected screen underneath is still showing.
 *
 * No-op on web — `expo-screen-capture` is native-only and throws if invoked in the browser.
 */
export function useSensitiveScreen(): void {
  const key = `palpeer-sensitive-${useId()}`;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;
    void ScreenCapture.preventScreenCaptureAsync(key).catch((error: unknown) => {
      if (active) logger.warn('Screen capture prevention unavailable', { error });
    });

    return () => {
      active = false;
      void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
    };
  }, [key]);
}

/** For conditionally shown secrets (such as the PIN sheet): render only while the secret is visible. */
export function SensitiveScreenGuard(): null {
  useSensitiveScreen();
  return null;
}
