import { apiBinaryRequest, apiRequest, type BinaryResponse } from '@/services/api/client';
import type { KycCaseSummary, SpringPage } from '@/types/admin';
import type { AdminKycCaseDetail, ReviewKycInput } from '@/types/kyc';

export async function listKycCases(params?: {
  page?: number;
  size?: number;
  sort?: string;
  status?: string;
  userId?: string;
}): Promise<SpringPage<KycCaseSummary>> {
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;
  const search = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (params?.sort) {
    search.set('sort', params.sort);
  }
  if (params?.status) {
    search.set('status', params.status);
  }
  if (params?.userId) {
    search.set('userId', params.userId);
  }
  return apiRequest<SpringPage<KycCaseSummary>>(`/admin/kyc/cases?${search.toString()}`);
}

export async function getKycCase(caseId: string): Promise<AdminKycCaseDetail> {
  return apiRequest<AdminKycCaseDetail>(`/admin/kyc/cases/${encodeURIComponent(caseId)}`);
}

export async function getKycDocumentContent(
  caseId: string,
  documentId: string,
  signal?: AbortSignal,
): Promise<BinaryResponse> {
  return apiBinaryRequest(
    `/admin/kyc/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/content`,
    { signal },
  );
}

export async function getKycSelfieContent(
  caseId: string,
  signal?: AbortSignal,
): Promise<BinaryResponse> {
  return apiBinaryRequest(`/admin/kyc/cases/${encodeURIComponent(caseId)}/selfie/content`, {
    signal,
  });
}

export async function reviewKycCase(
  caseId: string,
  input: ReviewKycInput,
): Promise<KycCaseSummary> {
  return apiRequest<KycCaseSummary>(`/admin/kyc/cases/${caseId}/review`, {
    method: 'POST',
    body: {
      status: input.status,
      rejectionReason: input.rejectionReason ?? null,
    },
  });
}
