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

/** After both captures, return to Show your ID (agree + Send to Palpeer). */
const DESIGN_KYC_SHOW = '/StartKyc';
/** After Send to Palpeer, wait while ComplyCube runs. */
const DESIGN_KYC_CHECKING = '/StartChecking';

export type KycCaptureStart = 'camera' | 'library';

/**
 * KYC for design Start: Choose my ID / Take photo open the ComplyCube capture
 * pipeline (document camera or library upload → live selfie → start verification).
 */
export function useLiveKyc() {
  const dispatch = useAppDispatch();
  const profile = useEnsureProfile();
  const progressQ = useGetKycProgressQuery();
  const [startVerification] = useStartKycVerificationMutation();
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycBusy, setKycBusy] = useState(false);

  /** Open document capture; optional `start` skips the intro (camera or library). */
  const openDocumentCapture = useCallback((documentType: string, start?: KycCaptureStart) => {
    setKycError(null);
    const type: KycDocumentType = isKycDocumentType(documentType)
      ? documentType
      : 'PASSPORT';
    router.push({
      pathname: '/kyc/document',
      params: {
        type,
        returnTo: DESIGN_KYC_SHOW,
        ...(start ? { start } : null),
      },
    } as Href);
  }, []);

  /** Pick an ID type → ComplyCube document capture. */
  const onPickDocumentType = useCallback(
    (documentType: string) => {
      openDocumentCapture(documentType);
    },
    [openDocumentCapture],
  );

  /** Live selfie capture for ComplyCube (front camera only). */
  const onUploadSelfie = useCallback(async (): Promise<OkErr> => {
    setKycError(null);
    router.push({
      pathname: '/kyc/selfie',
      params: { returnTo: DESIGN_KYC_SHOW },
    } as Href);
    return { ok: true };
  }, []);

  /** Document capture from Show your ID — camera or upload. */
  const onUploadDocument = useCallback(
    async (documentType = 'PASSPORT', start?: KycCaptureStart): Promise<OkErr> => {
      openDocumentCapture(documentType, start);
      return { ok: true };
    },
    [openDocumentCapture],
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
      router.replace(DESIGN_KYC_CHECKING as Href);
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
