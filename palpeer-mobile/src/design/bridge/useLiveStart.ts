import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { authErrorMessage } from '@/features/auth/errors';
import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { useSubmitBusinessInterestMutation } from '@/services/api/businessInterestApi';
import { apiRequest } from '@/services/api/client';
import { toAppError } from '@/services/api/errors';
import { useAppSelector } from '@/store';

import { useLiveAuth } from './useLiveAuth';
import { useLiveKyc } from './useLiveKyc';
import { useLiveSecurity } from './useLiveSecurity';

type OkErr = { ok: true } | { ok: false; error: string };

function homePathForCountry(country: string | null | undefined): '/StartHomeCad' | '/StartHomeNgn' {
  return String(country || '').toUpperCase() === 'NG' ? '/StartHomeNgn' : '/StartHomeCad';
}

function normalizeIso2List(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => String(c ?? '').trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

/** Combined Start-screen bridge: auth + KYC + PIN/questions/profile + public rates. */
export function useLiveStart() {
  const auth = useLiveAuth();
  const kyc = useLiveKyc();
  const security = useLiveSecurity();
  const profile = useEnsureProfile();
  const sessionEmail = useAppSelector((state) => state.session.email);
  /**
   * Load Admin → Settings → Registration countries (enabled ISO2) via a plain request.
   * RTK Query refetchOnFocus was aborting this call mid-flight on web, so the landing
   * hero never left the stand-in CA/NG/GH/KE flags.
   */
  const [registrationCountries, setRegistrationCountries] = useState<string[] | undefined>(undefined);
  const [submitBusinessInterest] = useSubmitBusinessInterestMutation();
  const [bizError, setBizError] = useState<string | null>(null);
  const { setupRequired, gate, returnTo } = useLocalSearchParams<{
    setupRequired?: string;
    gate?: string;
    returnTo?: string;
  }>();
  const required = setupRequired === '1';
  const openGate = gate === '1' || required;

  const loadRegistrationCountries = useCallback(async () => {
    const result = await apiRequest<string[]>('/public/registration-countries');
    if (!result.ok) return;
    setRegistrationCountries(normalizeIso2List(result.data));
  }, []);

  useEffect(() => {
    void loadRegistrationCountries();
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') void loadRegistrationCountries();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [loadRegistrationCountries]);

  const greetingName = useMemo(() => {
    const first = profile.profile?.firstName?.trim();
    if (first) return first;
    const email = sessionEmail?.trim();
    if (email?.includes('@')) return email.split('@')[0] || 'friend';
    return 'friend';
  }, [profile.profile?.firstName, sessionEmail]);

  const onAfterPinSet = useCallback(() => {
    router.replace({ pathname: '/StartQuestions', params: { setupRequired: '1' } });
  }, []);

  /** After security questions: honor returnTo, else first Home with Complete your profile. */
  const onSetupComplete = useCallback(() => {
    if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/')) {
      router.replace(returnTo as '/');
      return;
    }
    const path = homePathForCountry(profile.profile?.countryOfResidence);
    router.replace({ pathname: path, params: { gate: '1' } });
  }, [profile.profile?.countryOfResidence, returnTo]);

  const clearAuthError = useCallback(() => {
    setBizError(null);
    auth.clearAuthError();
  }, [auth]);

  const onSubmitBusinessInterest = useCallback(
    async (email: string): Promise<OkErr> => {
      setBizError(null);
      auth.clearAuthError();
      try {
        await submitBusinessInterest({ email: email.trim() }).unwrap();
        return { ok: true };
      } catch (error) {
        const msg = authErrorMessage(toAppError(error));
        setBizError(msg);
        return { ok: false, error: msg };
      }
    },
    [auth, submitBusinessInterest],
  );

  return {
    ...auth,
    ...kyc,
    ...security,
    authError: bizError || auth.authError,
    clearAuthError,
    registrationCountries,
    setupRequired: required,
    gate: openGate,
    uname: greetingName,
    fname: profile.profile?.firstName?.trim() || '',
    lname: profile.profile?.lastName?.trim() || '',
    onAfterPinSet: required ? onAfterPinSet : undefined,
    onSetupComplete: required ? onSetupComplete : undefined,
    onSubmitBusinessInterest,
  };
}
