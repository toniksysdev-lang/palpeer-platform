import type { IsoInstant, Uuid } from './common';

/** VERIFIED: backend `KycStatus` enum. */
export type KycStatus =
  'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

/** VERIFIED: GET /kyc/status. With no case: caseId/createdAt/updatedAt null, status NOT_STARTED. */
export type KycStatusResponse = {
  caseId: Uuid | null;
  userId: Uuid;
  status: KycStatus;
  rejectionReason: string | null;
  createdAt: IsoInstant | null;
  updatedAt: IsoInstant | null;
};

/** VERIFIED: GET /kyc/progress. Counts only; no required-document list or percentage. */
export type KycProgressResponse = {
  caseId: Uuid | null;
  status: KycStatus;
  hasDocument: boolean;
  documentCount: number;
  hasSelfie: boolean;
  selfieCount: number;
};

/** VERIFIED: 201 from POST /kyc/documents (multipart: documentType + file). */
export type KycDocumentResponse = {
  id: Uuid;
  kycCaseId: Uuid;
  documentType: string;
  contentType: string;
  originalFilename: string;
  sizeBytes: number;
};

/** VERIFIED: 201 from POST /kyc/selfie (multipart: file). */
export type SelfieResponse = {
  id: Uuid;
  kycCaseId: Uuid;
  contentType: string;
  originalFilename: string;
  sizeBytes: number;
};

/** VERIFIED: `StartKycVerificationRequest`. */
export type StartKycVerificationRequest = {
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD, optional. */
  dateOfBirth?: string;
  /** ISO-3166 alpha-2, optional. */
  issuingCountry?: string;
};

/** VERIFIED: 202 from POST /kyc/verification/start. */
export type KycVerificationResponse = {
  caseId: Uuid;
  status: KycStatus;
  providerName: string;
  providerClientId: string;
  providerCheckId: string;
};
