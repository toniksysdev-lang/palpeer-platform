import { useEffect } from 'react';

import { appConfig } from '@/config/env';
import { sessionManager } from '@/services/auth/session';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { biometricRestored } from '@/store/slices/appLockSlice';
import { preferencesLoaded } from '@/store/slices/preferencesSlice';
import { sessionAbsent } from '@/store/slices/sessionSlice';
import { logger } from '@/utils/logger';

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(resolve, () => resolve(fallback)).finally(() => clearTimeout(timer));
  });
}

/**
 * Loads preferences and restores the session once. Resolves within `sessionRestoreTimeoutMs`
 * so the splash never hangs; a timed-out restore falls back to sign-in.
 * Ready as soon as bootstrap finishes — no artificial minimum splash delay.
 */
export function useAppBootstrap(): { ready: boolean } {
  const dispatch = useAppDispatch();
  const preferencesReady = useAppSelector((state) => state.preferences.loaded);
  const sessionStatus = useAppSelector((state) => state.session.status);

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
    ready: preferencesReady && sessionStatus !== 'restoring',
  };
}
