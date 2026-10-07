import { ApiClientError } from '@/types/api';
import type { KycCaseSummary, SpringPage } from '@/types/admin';
import type { BinaryResponse } from '@/services/api/client';
import type { AdminKycCaseDetail, KycDocumentMetadata, ReviewKycInput } from '@/types/kyc';

const now = Date.now();

function daysAgo(days: number): string {
  return new Date(now - 86400000 * days).toISOString();
}

const catalog: KycCaseSummary[] = [
  {
    caseId: 'kyc-1',
    userId: 'u-2',
    status: 'UNDER_REVIEW',
    rejectionReason: null,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },
  {
    caseId: 'kyc-2',
    userId: 'u-3',
    status: 'APPROVED',
    rejectionReason: null,
    createdAt: daysAgo(18),
    updatedAt: daysAgo(16),
  },
  {
    caseId: 'kyc-3',
    userId: 'u-4',
    status: 'SUBMITTED',
    rejectionReason: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    caseId: 'kyc-4',
    userId: 'u-5',
    status: 'REJECTED',
    rejectionReason: 'Document image was unreadable.',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(28),
  },
  {
    caseId: 'kyc-5',
    userId: 'u-1',
    status: 'IN_PROGRESS',
    rejectionReason: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

const documentsByCase: Record<string, KycDocumentMetadata[]> = {
  'kyc-1': [
    {
      id: 'doc-1',
      documentType: 'PASSPORT',
      contentType: 'image/svg+xml',
      originalFilename: 'passport-front.svg',
      sizeBytes: 482,
      createdAt: daysAgo(2),
    },
    {
      id: 'doc-2',
      documentType: 'PROOF_OF_ADDRESS',
      contentType: 'application/pdf',
      originalFilename: 'utility-bill.pdf',
      sizeBytes: 612,
      createdAt: daysAgo(2),
    },
  ],
  'kyc-3': [
    {
      id: 'doc-3',
      documentType: 'DRIVERS_LICENSE',
      contentType: 'image/svg+xml',
      originalFilename: 'license.svg',
      sizeBytes: 470,
      createdAt: daysAgo(5),
    },
  ],
  'kyc-4': [
    {
      id: 'doc-4',
      documentType: 'NATIONAL_ID',
      contentType: 'image/svg+xml',
      originalFilename: 'id-card.svg',
      sizeBytes: 455,
      createdAt: daysAgo(30),
    },
  ],
};

const selfieCases = new Set(['kyc-1', 'kyc-2', 'kyc-4']);

function toPage<T>(rows: T[], page: number, size: number): SpringPage<T> {
  const start = page * size;
  const content = rows.slice(start, start + size);
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export function mockListKycCases(params?: {
  page?: number;
  size?: number;
  status?: string;
  userId?: string;
}): SpringPage<KycCaseSummary> {
  const rows = catalog
    .filter(
      (item) =>
        (!params?.status || item.status === params.status) &&
        (!params?.userId || item.userId === params.userId),
    )
    .map((item) => ({ ...item }));
  return toPage(rows, params?.page ?? 0, params?.size ?? 20);
}

export function mockGetKycCase(caseId: string): AdminKycCaseDetail {
  const found = catalog.find((item) => item.caseId === caseId);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'KYC case not found');
  }
  return {
    ...found,
    documents: (documentsByCase[caseId] ?? []).map((doc) => ({ ...doc })),
    selfie: selfieCases.has(caseId)
      ? {
          id: `selfie-${caseId}`,
          contentType: 'image/svg+xml',
          originalFilename: 'selfie.svg',
          sizeBytes: 430,
          createdAt: found.createdAt ?? daysAgo(1),
        }
      : null,
  };
}

function mockSvg(label: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><rect width="480" height="300" rx="16" fill="#eef2f7"/><rect x="24" y="24" width="120" height="150" rx="8" fill="#cbd5e1"/><text x="170" y="70" font-family="sans-serif" font-size="20" fill="#334155">MOCK KYC</text><text x="170" y="110" font-family="sans-serif" font-size="14" fill="#475569">${label}</text><text x="24" y="260" font-family="monospace" font-size="12" fill="#64748b">Not a real document</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function mockPdf(label: string): Blob {
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 60>>stream
BT /F1 16 Tf 30 120 Td (MOCK KYC ${label.replace(/[()\\]/g, '')}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function mockKycDocumentContent(caseId: string, documentId: string): BinaryResponse {
  const doc = (documentsByCase[caseId] ?? []).find((item) => item.id === documentId);
  if (!doc) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'KYC document not found');
  }
  const blob =
    doc.contentType === 'application/pdf' ? mockPdf(doc.documentType) : mockSvg(doc.documentType);
  return { blob, contentType: doc.contentType, filename: doc.originalFilename ?? null };
}

export function mockKycSelfieContent(caseId: string): BinaryResponse {
  if (!selfieCases.has(caseId)) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Selfie not found');
  }
  return { blob: mockSvg('SELFIE'), contentType: 'image/svg+xml', filename: 'selfie.svg' };
}

export function mockReviewKycCase(caseId: string, input: ReviewKycInput): KycCaseSummary {
  const index = catalog.findIndex((item) => item.caseId === caseId);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'KYC case not found');
  }
  if (input.status === 'REJECTED' && !input.rejectionReason?.trim()) {
    throw new ApiClientError(
      400,
      'KYC_REJECTION_REASON_REQUIRED',
      'rejectionReason required when rejecting',
    );
  }
  const current = catalog[index]!;
  const next: KycCaseSummary = {
    ...current,
    status: input.status,
    rejectionReason:
      input.status === 'REJECTED' ? input.rejectionReason!.trim() : null,
    updatedAt: new Date().toISOString(),
  };
  catalog[index] = next;
  return { ...next };
}
