import { useCallback, useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';

import { isKycDocumentType, type KycDocumentType } from '@/features/kyc/kycState';
import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { toAppError } from '@/services/api/errors';
import {
  useGetKycProgressQuery,
  useGetKycStatusQuery,
  useStartKycVerificationMutation,
} from '@/services/api/kycApi';
import { baseApi } from '@/services/api/baseApi';
import { useAppDispatch } from '@/store';

type OkErr = { ok: true } | { ok: false; error: string };

/** After ComplyCube capture + submit, design flow waits on StartChecking. */
const DESIGN_KYC_RETURN = '/StartChecking';

/**
 * KYC for design Start: Choose my ID opens the ComplyCube camera pipeline
 * (document → live selfie → start verification), not the gallery picker.
 */
export function useLiveKyc() {
  const dispatch = useAppDispatch();
  const profile = useEnsureProfile();
  const progressQ = useGetKycProgressQuery();
  const [startVerification] = useStartKycVerificationMutation();
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycBusy, setKycBusy] = useState(false);

  /** Pick an ID type → ComplyCube document capture (camera). */
  const onPickDocumentType = useCallback((documentType: string) => {
    setKycError(null);
    const type: KycDocumentType = isKycDocumentType(documentType)
      ? documentType
      : 'PASSPORT';
    router.push({
      pathname: '/kyc/document',
      params: { type, returnTo: DESIGN_KYC_RETURN },
    } as Href);
  }, []);

  /** Live selfie capture for ComplyCube (front camera only). */
  const onUploadSelfie = useCallback(async (): Promise<OkErr> => {
    setKycError(null);
    router.push({
      pathname: '/kyc/selfie',
      params: { returnTo: DESIGN_KYC_RETURN },
    } as Href);
    return { ok: true };
  }, []);

  /** Document re-capture — same as picking the current type again. */
  const onUploadDocument = useCallback(
    async (documentType = 'PASSPORT'): Promise<OkErr> => {
      onPickDocumentType(documentType);
      return { ok: true };
    },
    [onPickDocumentType],
  );

  const onSubmitKyc = useCallback(async (): Promise<OkErr> => {
    setKycError(null);
    setKycBusy(true);
    try {
      const firstName = profile.profile?.firstName?.trim() || 'Pending';
      const lastName = profile.profile?.lastName?.trim() || 'Pending';
      await startVerification({
        firstName,
        lastName,
        dateOfBirth: profile.profile?.dateOfBirth ?? undefined,
        issuingCountry: profile.profile?.countryOfResidence ?? undefined,
      }).unwrap();
      dispatch(baseApi.util.invalidateTags(['KycStatus']));
      router.replace(DESIGN_KYC_RETURN as Href);
      return { ok: true };
    } catch (error) {
      const msg = toAppError(error).message ?? 'Could not start verification.';
      setKycError(msg);
      return { ok: false, error: msg };
    } finally {
      setKycBusy(false);
    }
  }, [dispatch, profile.profile, startVerification]);

  return {
    backend: true as const,
    kycError,
    kycBusy,
    /** Sync Show my ID rings after ComplyCube uploads. */
    idDone: Boolean(progressQ.data?.hasDocument),
    selfieDone: Boolean(progressQ.data?.hasSelfie),
    clearKycError: () => setKycError(null),
    onPickDocumentType,
    onUploadDocument,
    onUploadSelfie,
    onSubmitKyc,
  };
}

/**
 * Poll ComplyCube / backend KYC status while on the design “Palpeer is checking” screen.
 */
export function useKycStatusNavigation() {
  const statusQ = useGetKycStatusQuery(undefined, { pollingInterval: 2500 });

  useEffect(() => {
    const status = statusQ.data?.status;
    if (!status) return;
    if (status === 'APPROVED') {
      router.replace('/StartVerified' as Href);
      return;
    }
    if (status === 'REJECTED') {
      router.replace('/StartKycFail' as Href);
    }
  }, [statusQ.data?.status]);
}
