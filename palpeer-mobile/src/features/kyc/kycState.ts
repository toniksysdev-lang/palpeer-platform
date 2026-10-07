import type { KycProgressResponse, KycStatus } from '@/types/api/kyc';

/**
 * Document types the backend maps to ComplyCube document classes (ComplyCubeKycProvider).
 * The backend accepts free text, so this list is the app's choice (CONTRACT_PENDING K-1).
 */
export const KYC_DOCUMENT_TYPES = [
  { value: 'PASSPORT', label: 'Passport', hint: 'Photo page with your details' },
  { value: 'NATIONAL_ID', label: 'National ID card', hint: 'Front of the card' },
  { value: 'DRIVING_LICENSE', label: "Driver's licence", hint: 'Front of the licence' },
  { value: 'RESIDENCE_PERMIT', label: 'Residence permit', hint: 'Front of the permit' },
] as const;

export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number]['value'];

export function isKycDocumentType(value: unknown): value is KycDocumentType {
  return KYC_DOCUMENT_TYPES.some((type) => type.value === value);
}

export function documentTypeLabel(value: string | null | undefined): string {
  return KYC_DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? 'Identity document';
}

/** VERIFIED (KycService.UPLOAD_ALLOWED): uploads and verification start are accepted only here. */
const UPLOAD_ALLOWED: readonly KycStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'REJECTED'];

export function canUpload(status: KycStatus | null | undefined): boolean {
  return status != null && UPLOAD_ALLOWED.includes(status);
}

export type KycPhase = 'collecting' | 'reviewing' | 'approved' | 'rejected';

export function kycPhase(status: KycStatus): KycPhase {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'reviewing';
    default:
      return 'collecting';
  }
}

export type KycNextStep = 'document' | 'selfie' | 'submit' | null;

/**
 * Next action while uploads are open. Verification needs a document; the selfie is optional on the
 * backend (it falls back to a document-only check) but the app always asks for one.
 */
export function nextKycStep(
  progress: Pick<KycProgressResponse, 'status' | 'hasDocument' | 'hasSelfie'>,
): KycNextStep {
  if (!canUpload(progress.status)) return null;
  if (!progress.hasDocument) return 'document';
  if (!progress.hasSelfie) return 'selfie';
  return 'submit';
}
