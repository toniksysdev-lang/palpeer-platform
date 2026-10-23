import { useEffect } from 'react';

import { appConfig } from '@/config/env';
import { sessionManager } from '@/services/auth/session';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { secureStorage } from '@/services/storage/secureStorage';
import { store, useAppDispatch, useAppSelector } from '@/store';
import { biometricRestored } from '@/store/slices/appLockSlice';
import { preferencesLoaded } from '@/store/slices/preferencesSlice';
import { sessionAbsent } from '@/store/slices/sessionSlice';
import { logger } from '@/utils/logger';

const DEFAULT_PREFERENCES = {
  appearance: 'light' as const,
  onboardingSeen: false,
  biometricUnlockPrompted: false,
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(resolve, () => resolve(fallback)).finally(() => clearTimeout(timer));
  });
}

/**
 * Loads preferences and restores the session once.
 * Whole bootstrap is capped so SecureStore / network stalls cannot leave BrandSplash forever.
 * Ready as soon as bootstrap finishes — no artificial minimum splash delay.
 */
export function useAppBootstrap(): { ready: boolean } {
  const dispatch = useAppDispatch();
  const preferencesReady = useAppSelector((state) => state.preferences.loaded);
  const sessionStatus = useAppSelector((state) => state.session.status);

  useEffect(() => {
    let cancelled = false;
    const hardDeadlineMs = Math.max(appConfig.sessionRestoreTimeoutMs + 4_000, 12_000);

    (async () => {
      const run = async () => {
        const preferences = await withTimeout(
          preferencesStorage.load(),
          3_000,
          DEFAULT_PREFERENCES,
        );
        if (cancelled) return;
        dispatch(preferencesLoaded(preferences));

        // Lock before the session becomes authenticated so the app never renders unlocked first.
        const [stored, biometricUserId] = await withTimeout(
          Promise.all([secureStorage.loadSession(), secureStorage.getBiometricUserId()]),
          3_000,
          [null, null] as const,
        );
        if (cancelled) return;
        dispatch(biometricRestored(!!stored && biometricUserId === stored.userId));

        const outcome = await withTimeout(
          sessionManager.restore(),
          appConfig.sessionRestoreTimeoutMs,
          'unauthenticated' as const,
        );
        if (cancelled) return;
        // Authenticated path is handled by sessionManager → store listener (sessionStarted).
        if (outcome === 'unauthenticated') {
          dispatch(sessionAbsent());
        }
      };

      const finished = await withTimeout(
        run().then(() => 'done' as const),
        hardDeadlineMs,
        'timeout' as const,
      );
      if (cancelled) return;

      // Failsafe only when still stuck in restoring (timeout / hung SecureStore / missed listener).
      if (!store.getState().preferences.loaded) {
        dispatch(preferencesLoaded(DEFAULT_PREFERENCES));
      }
      if (store.getState().session.status === 'restoring') {
        logger.warn('Bootstrap failsafe: forcing unauthenticated', { finished });
        dispatch(sessionAbsent());
      }
    })().catch((error: unknown) => {
      logger.error('Bootstrap failed', { error });
      if (!cancelled) {
        dispatch(preferencesLoaded(DEFAULT_PREFERENCES));
        dispatch(sessionAbsent());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return {
    ready: preferencesReady && sessionStatus !== 'restoring',
  };
}
