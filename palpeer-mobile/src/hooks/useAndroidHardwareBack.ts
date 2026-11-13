import { usePathname, router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

const TAB_ROOTS = ['/Main', '/History', '/Messages', '/More'] as const;

function isTabRoot(path: string): boolean {
  return TAB_ROOTS.some((p) => path === p || path.startsWith(`${p}?`));
}

function isHomeTab(path: string): boolean {
  return path === '/Main' || path.startsWith('/Main?');
}

/**
 * Android system Back: navigate within the app instead of finishing the activity.
 * Tab roots use replace (same as BottomNav); other screens prefer router.back().
 */
export function useAndroidHardwareBack(enabled: boolean) {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const path = pathname || '/';

      if (isTabRoot(path)) {
        if (!isHomeTab(path)) {
          router.replace('/Main');
        }
        // Stay on Home — do not exit the app.
        return true;
      }

      // Start / Welcome use local stage state — their own BackHandler owns hardware Back.
      // Do not steal the event here or stage never moves (login → land, rates → land, …).
      if (path === '/' || path.startsWith('/Start') || path.startsWith('/index') || path.startsWith('/(design)')) {
        return false;
      }

      if (router.canGoBack()) {
        router.back();
        return true;
      }

      router.replace('/');
      return true;
    });

    return () => sub.remove();
  }, [enabled, pathname]);
}
