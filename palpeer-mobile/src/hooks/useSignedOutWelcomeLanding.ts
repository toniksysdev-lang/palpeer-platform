import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';

/** Deep-link entry points that must not be redirected away on cold start. */
const PRESERVE_WHEN_SIGNED_OUT = [
  '/forgot-password',
  '/reset-password',
  '/enter-phone',
  '/verify-email',
  '/verify-phone',
  '/register',
  '/support',
  '/view-rates',
  '/p2p-share',
  '/login',
] as const;

/**
 * When signed out, land on Welcome once the root navigator is ready.
 * Expo Router otherwise may land on Login among unsigned screens; this corrects that once.
 */
export function useSignedOutWelcomeLanding(ready: boolean, isAuthenticated: boolean) {
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const navigatorReady = navigationState?.key != null;
  /** True after we've accepted Welcome (or a preserved deep link) for this signed-out stretch. */
  const settled = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      settled.current = false;
      return;
    }
    if (!ready || !navigatorReady) return;

    if (pathname === '/welcome' || pathname === '/') {
      settled.current = true;
      return;
    }

    if (PRESERVE_WHEN_SIGNED_OUT.some((path) => pathname.startsWith(path))) {
      settled.current = true;
      return;
    }

    // User already reached Welcome (or a preserved link); Login/Register pushes must stay.
    if (settled.current) return;

    settled.current = true;
    router.replace('/welcome');
  }, [ready, isAuthenticated, navigatorReady, pathname]);
}
