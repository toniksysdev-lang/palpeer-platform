import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/store';
import { appLocked } from '@/store/slices/appLockSlice';

/**
 * CLIENT rule: re-lock after any background while unlocked. Biometric prompts run while
 * already locked, so they do not set a background timestamp (see listener below).
 */
export const LOCK_AFTER_BACKGROUND_MS = 0;

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
        // Only track while unlocked — LockScreen biometric prompts background the
        // activity; re-locking afterward would bounce the user back to PIN/biometrics.
        // Skip `inactive` (Control Center / notification shade) so those do not lock.
        if (!locked) backgroundedAt = Date.now();
      } else if (state === 'active') {
        markUserActive();
        if (backgroundedAt !== null) {
          const away = Date.now() - backgroundedAt;
          if (away >= LOCK_AFTER_BACKGROUND_MS) {
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
