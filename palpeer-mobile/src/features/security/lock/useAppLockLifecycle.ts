import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppDispatch } from '@/store';
import { appLocked } from '@/store/slices/appLockSlice';

/**
 * CLIENT rule: re-lock after the app has spent at least this long in the background. Short trips
 * (the biometric prompt itself, a quick app switch) don't re-lock.
 */
export const LOCK_AFTER_BACKGROUND_MS = 60_000;

export function useAppLockLifecycle() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
      } else if (state === 'active' && backgroundedAt !== null) {
        if (Date.now() - backgroundedAt >= LOCK_AFTER_BACKGROUND_MS) dispatch(appLocked());
        backgroundedAt = null;
      }
    });
    return () => subscription.remove();
  }, [dispatch]);
}
