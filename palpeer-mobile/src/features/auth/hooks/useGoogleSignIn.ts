import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import { appConfig } from '@/config/env';
import { accountCommands } from '@/services/auth/accountCommands';
import { sessionManager } from '@/services/auth/session';
import { toAppError } from '@/services/api/errors';

import { authErrorMessage } from '../errors';

WebBrowser.maybeCompleteAuthSession();

export function isGoogleSignInConfigured(): boolean {
  return Boolean(appConfig.google.webClientId);
}

/**
 * Google Sign-In via ID token → POST /auth/google → session start.
 * Hidden when no web client ID is configured.
 */
export function useGoogleSignIn() {
  const configured = isGoogleSignInConfigured();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    configured
      ? {
          clientId: appConfig.google.webClientId!,
          androidClientId: appConfig.google.androidClientId ?? undefined,
          iosClientId: appConfig.google.iosClientId ?? undefined,
        }
      : {
          // Hook requires a clientId; disabled path never prompts.
          clientId: 'disabled.apps.googleusercontent.com',
        },
  );

  useEffect(() => {
    if (!configured || !response) return;
    if (response.type !== 'success') {
      if (response.type === 'error') {
        setError('Google sign-in was cancelled or failed.');
      }
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      setError('Google did not return an ID token. Check the OAuth client configuration.');
      return;
    }

    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const tokens = await accountCommands.loginWithGoogle({ idToken });
        if (!tokens.ok) throw tokens.error;
        await sessionManager.start(tokens.data, null);
      } catch (raw) {
        if (!cancelled) setError(authErrorMessage(toAppError(raw)));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, response]);

  const signIn = useCallback(async () => {
    if (!configured) {
      setError('Google Sign-In is not configured for this build.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') {
        setBusy(false);
        if (result.type === 'error') {
          setError('Google sign-in was cancelled or failed.');
        }
      }
      // success: the effect exchanges the ID token and clears busy
    } catch {
      setError('Google sign-in failed. Try again.');
      setBusy(false);
    }
  }, [configured, promptAsync]);

  return {
    configured,
    ready: configured && request != null,
    busy,
    error,
    clearError: () => setError(null),
    signIn,
  };
}
