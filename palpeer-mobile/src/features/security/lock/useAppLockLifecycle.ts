import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/store';
import { appLocked } from '@/store/slices/appLockSlice';

/**
 * CLIENT rule: re-lock after the app has spent at least this long in the background. Short trips
 * (the biometric prompt itself, a quick app switch) don't re-lock.
 */
export const LOCK_AFTER_BACKGROUND_MS = 60_000;

/** Design Timeout: idle on the foreground for this long → “You were logged out”. */
export const IDLE_LOGOUT_MS = 180_000;

const IDLE_POLL_MS = 5_000;

let lastActivityAt = Date.now();

/** Call from the root touch capture so foreground idle tracking stays accurate. */
export function markUserActive(): void {
  lastActivityAt = Date.now();
}

export function useAppLockLifecycle() {
  const dispatch = useAppDispatch();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);

  useEffect(() => {
    if (!authenticated) {
      markUserActive();
      return;
    }

    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
      } else if (state === 'active') {
        markUserActive();
        if (backgroundedAt !== null) {
          const away = Date.now() - backgroundedAt;
          // Background trips re-lock when biometrics are on (keep short switches unlockable).
          // Long trips also count as inactivity for everyone.
          if (away >= LOCK_AFTER_BACKGROUND_MS && biometricEnabled) {
            dispatch(appLocked());
          } else if (away >= IDLE_LOGOUT_MS) {
            dispatch(appLocked());
          }
          backgroundedAt = null;
        }
      }
    });

    const idle = setInterval(() => {
      if (locked) return;
      if (AppState.currentState !== 'active') return;
      if (Date.now() - lastActivityAt >= IDLE_LOGOUT_MS) {
        dispatch(appLocked());
      }
    }, IDLE_POLL_MS);

    return () => {
      subscription.remove();
      clearInterval(idle);
    };
  }, [authenticated, biometricEnabled, dispatch, locked]);
}
