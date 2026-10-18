import { useEffect, useState } from 'react';

import { appConfig } from '@/config/env';
import { sessionManager } from '@/services/auth/session';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { biometricRestored } from '@/store/slices/appLockSlice';
import { preferencesLoaded } from '@/store/slices/preferencesSlice';
import { sessionAbsent } from '@/store/slices/sessionSlice';
import { logger } from '@/utils/logger';

/** Minimum branded splash time on every cold open so bootstrap never skips past it. */
export const MIN_SPLASH_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(resolve, () => resolve(fallback)).finally(() => clearTimeout(timer));
  });
}

/**
 * Loads preferences and restores the session once. Resolves within `sessionRestoreTimeoutMs`
 * so the splash never hangs; a timed-out restore falls back to sign-in.
 * Always keeps the branded splash up for at least {@link MIN_SPLASH_MS} on each cold start.
 */
export function useAppBootstrap(): { ready: boolean } {
  const dispatch = useAppDispatch();
  const preferencesReady = useAppSelector((state) => state.preferences.loaded);
  const sessionStatus = useAppSelector((state) => state.session.status);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const preferences = await preferencesStorage.load();
      if (cancelled) return;
      dispatch(preferencesLoaded(preferences));

      // Lock before the session becomes authenticated so the app never renders unlocked first.
      const [stored, biometricUserId] = await Promise.all([
        secureStorage.loadSession(),
        secureStorage.getBiometricUserId(),
      ]);
      if (cancelled) return;
      dispatch(biometricRestored(!!stored && biometricUserId === stored.userId));

      const outcome = await withTimeout(
        sessionManager.restore(),
        appConfig.sessionRestoreTimeoutMs,
        'unauthenticated' as const,
      );
      if (cancelled) return;
      if (outcome === 'unauthenticated') {
        dispatch(sessionAbsent());
      }
    })().catch((error: unknown) => {
      logger.error('Bootstrap failed', { error });
      if (!cancelled) dispatch(sessionAbsent());
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return {
    ready: minSplashElapsed && preferencesReady && sessionStatus !== 'restoring',
  };
}
