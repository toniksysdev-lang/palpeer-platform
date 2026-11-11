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
  language: 'en' as const,
  onboardingSeen: false,
  biometricUnlockPrompted: false,
};

/** Soft cap for local storage reads — must not dominate cold start. */
const LOCAL_READ_MS = 1_200;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(resolve, () => resolve(fallback)).finally(() => clearTimeout(timer));
  });
}

/**
 * Loads preferences and restores the session once.
 * Signed-out installs leave BrandSplash as soon as local storage says there is no session
 * (no network wait). Whole bootstrap is still hard-capped for hung SecureStore / refresh.
 */
export function useAppBootstrap(): { ready: boolean } {
  const dispatch = useAppDispatch();
  const preferencesReady = useAppSelector((state) => state.preferences.loaded);
  const sessionStatus = useAppSelector((state) => state.session.status);

  useEffect(() => {
    let cancelled = false;
    const restoreBudgetMs = appConfig.sessionRestoreTimeoutMs;
    const hardDeadlineMs = Math.max(restoreBudgetMs + LOCAL_READ_MS + 1_500, 6_000);

    (async () => {
      const run = async () => {
        // Preferences + session keys in parallel — was sequential and slowed every cold start.
        const [preferences, stored, biometricUserId] = await Promise.all([
          withTimeout(preferencesStorage.load(), LOCAL_READ_MS, DEFAULT_PREFERENCES),
          withTimeout(secureStorage.loadSession(), LOCAL_READ_MS, null),
          withTimeout(secureStorage.getBiometricUserId(), LOCAL_READ_MS, null),
        ]);
        if (cancelled) return;

        dispatch(preferencesLoaded(preferences));
        dispatch(biometricRestored(!!stored && biometricUserId === stored?.userId));

        // Fast path: no refresh token → show landing immediately (no /auth/refresh wait).
        if (!stored) {
          dispatch(sessionAbsent());
          return;
        }

        // Lock before the session becomes authenticated so the app never renders unlocked first.
        const outcome = await withTimeout(
          sessionManager.restore(),
          restoreBudgetMs,
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
