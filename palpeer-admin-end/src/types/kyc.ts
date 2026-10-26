export const KYC_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;

export type KycStatus = (typeof KYC_STATUSES)[number];

/** Statuses an admin may set via POST /admin/kyc/cases/{caseId}/review */
export const KYC_REVIEW_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;

export type KycReviewStatus = (typeof KYC_REVIEW_STATUSES)[number];

export type KycDocumentMetadata = {
  id: string;
  documentType: string;
  contentType: string;
  originalFilename?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

export type KycSelfieMetadata = {
  id: string;
  contentType: string;
  originalFilename?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  /** True once uploaded to ComplyCube as a live photo. */
  linkedToProvider?: boolean;
};

export type AdminKycCaseDetail = {
  caseId: string;
  userId: string;
  status: string;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  providerName?: string | null;
  providerClientId?: string | null;
  providerCheckId?: string | null;
  providerCheckType?: string | null;
  providerCheckStatus?: string | null;
  providerOutcome?: string | null;
  providerBreakdown?: string | null;
  liveIdentityCheck?: boolean;
  documents: KycDocumentMetadata[];
  selfie: KycSelfieMetadata | null;
};

export type ReviewKycInput = {
  status: KycReviewStatus;
  rejectionReason?: string | null;
};
