import { useCallback, useState } from 'react';
import { router, type Href } from 'expo-router';

import { authErrorMessage } from '@/features/auth/errors';
import { accountCommands } from '@/services/auth/accountCommands';
import { sessionManager } from '@/services/auth/session';
import { toAppError } from '@/services/api/errors';

/** Live props for design Change password screen. */
export function useLiveChangePassword() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(async (currentPassword: string, newPassword: string) => {
    setError(null);
    setBusy(true);
    try {
      const result = await accountCommands.changePassword({ currentPassword, newPassword });
      if (!result.ok) {
        const msg = authErrorMessage(result.error) || 'Could not change password.';
        setError(msg);
        return { ok: false as const, error: msg };
      }
      await sessionManager.signOut('passwordChanged');
      return { ok: true as const };
    } catch (raw) {
      const msg = toAppError(raw).message || 'Could not change password.';
      setError(msg);
      return { ok: false as const, error: msg };
    } finally {
      setBusy(false);
    }
  }, []);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/More' as Href);
  }, []);

  return {
    backend: true as const,
    busy,
    error,
    onSubmit,
    onBack,
  };
}
