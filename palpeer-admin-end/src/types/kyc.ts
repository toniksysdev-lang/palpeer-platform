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
};

export type AdminKycCaseDetail = {
  caseId: string;
  userId: string;
  status: string;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  documents: KycDocumentMetadata[];
  selfie: KycSelfieMetadata | null;
};

export type ReviewKycInput = {
  status: KycReviewStatus;
  rejectionReason?: string | null;
};
