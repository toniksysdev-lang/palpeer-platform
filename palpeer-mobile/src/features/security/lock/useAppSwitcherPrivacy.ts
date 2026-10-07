import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';

/**
 * Blurs the iOS app-switcher snapshot while signed in so balances and activity aren't visible
 * there. Android has no equivalent short of blocking screenshots app-wide; its recents thumbnail
 * is hidden only on screens that use `useSensitiveScreen`.
 */
export function useAppSwitcherPrivacy(enabled: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled) return;
    ScreenCapture.enableAppSwitcherProtectionAsync(1).catch((error: unknown) =>
      logger.warn('App switcher protection unavailable', { error }),
    );
    return () => {
      ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, [enabled]);
}
