import type { AppError } from '@/services/api/errors';

/** VERIFIED KYC error codes (KycService, ComplyCubeKycProvider) → user-facing copy. */
const MESSAGES: Record<string, string> = {
  KYC_UPLOAD_NOT_ALLOWED:
    "Your verification is already being reviewed or is complete, so new uploads aren't accepted.",
  FILE_REQUIRED: 'The photo was empty. Please take or choose it again.',
  DOCUMENT_TYPE_REQUIRED: 'Choose the type of document first.',
  KYC_DOCUMENT_REQUIRED: 'Upload a photo of your identity document before submitting.',
  KYC_SELFIE_REQUIRED: 'Take a live photo of your face before starting identity verification.',
  KYC_PROVIDER_DISABLED:
    "Identity verification isn't available yet. Your uploads are saved on your account — please try again later.",
  COMPLYCUBE_DISABLED:
    "Identity verification isn't available yet. Your uploads are saved on your account — please try again later.",
  STORAGE_WRITE_FAILED: "We couldn't save your photo. Please try again.",
  KYC_STORAGE_READ_FAILED:
    "We couldn't open your saved photos for review. Please re-upload your document (and selfie), then submit again.",
  FILE_TOO_LARGE: 'That photo is too large. Choose a smaller one or take it again.',
};

export function kycErrorMessage(error: AppError): string {
  return (error.code && MESSAGES[error.code]) || error.message;
}

/** Verification can't run on this backend right now; retrying immediately won't help. */
export function isVerificationUnavailable(error: AppError): boolean {
  return error.code === 'KYC_PROVIDER_DISABLED' || error.code === 'COMPLYCUBE_DISABLED';
}
