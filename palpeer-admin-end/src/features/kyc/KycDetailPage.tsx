import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Eye, FileText } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { KycPreviewDrawer, type KycPreviewTarget } from '@/features/kyc/KycPreviewDrawer';
import { formatDateTime, formatInteger, formatStatusLabel } from '@/lib/format';
import { mockGetKycCase, mockReviewKycCase } from '@/mocks/kyc';
import { getKycCase, reviewKycCase } from '@/services/api/kyc';
import type { KycCaseSummary } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import {
  KYC_REVIEW_STATUSES,
  type AdminKycCaseDetail,
  type KycReviewStatus,
} from '@/types/kyc';

type LocationState = {
  case?: KycCaseSummary;
};

type TimelineEvent = {
  key: string;
  at: string;
  title: string;
  detail?: string | null;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

function formatBytes(value?: number | null): string {
  if (value == null) return '—';
  if (value < 1024) return `${formatInteger(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: string): TimelineEvent['tone'] {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return 'warning';
  return 'info';
}

function buildTimeline(detail: AdminKycCaseDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (detail.createdAt) {
    events.push({ key: 'created', at: detail.createdAt, title: 'Case opened', tone: 'neutral' });
  }
  for (const doc of detail.documents) {
    events.push({
      key: `doc-${doc.id}`,
      at: doc.createdAt,
      title: `Document uploaded · ${formatStatusLabel(doc.documentType)}`,
      detail: doc.originalFilename,
      tone: 'info',
    });
  }
  if (detail.selfie) {
    events.push({
      key: 'selfie',
      at: detail.selfie.createdAt,
      title: 'Selfie uploaded',
      detail: detail.selfie.originalFilename,
      tone: 'info',
    });
  }
  if (detail.updatedAt) {
    events.push({
      key: 'updated',
      at: detail.updatedAt,
      title: `Status is ${formatStatusLabel(detail.status)}`,
      detail: detail.status === 'REJECTED' ? detail.rejectionReason : null,
      tone: statusTone(detail.status),
    });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

const TIMELINE_DOT: Record<TimelineEvent['tone'], string> = {
  neutral: 'bg-text-muted',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function KycDetailPage() {
  const { caseId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const canRead = can('kyc:read');
  const canReview = can('kyc:review');
  const canAudit = can('audit:read');

  const [statusDraft, setStatusDraft] = useState<KycReviewStatus>('UNDER_REVIEW');
  const [reasonDraft, setReasonDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<KycPreviewTarget | null>(null);

  const fromState = (location.state as LocationState | null)?.case;
  const initialSummary = fromState?.caseId === caseId ? fromState : undefined;

  const detailQuery = useQuery({
    queryKey: ['admin-kyc-case', caseId, appConfig.useMockApi],
    enabled: Boolean(caseId) && canRead,
    placeholderData: initialSummary
      ? { ...initialSummary, documents: [], selfie: null }
      : undefined,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockGetKycCase(caseId);
      }
      return getKycCase(caseId);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        status: statusDraft,
        rejectionReason: statusDraft === 'REJECTED' ? reasonDraft.trim() : null,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockReviewKycCase(caseId, payload);
      }
      return reviewKycCase(caseId, payload);
    },
    onSuccess: async (updated) => {
      setConfirmOpen(false);
      push({
        tone: 'success',
        title: 'KYC review saved',
        description: `Status is now ${updated.status}.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', caseId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-kyc'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'kyc'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-reports-summary'] });
      setReasonDraft('');
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : 'KYC review failed.';
      push({ tone: 'error', title: 'Review failed', description: message });
    },
  });

  const rejectionRequired = statusDraft === 'REJECTED';
  const rejectionValid = !rejectionRequired || reasonDraft.trim().length > 0;
  const reviewOptions = useMemo(() => [...KYC_REVIEW_STATUSES], []);
  const kycCase = detailQuery.data;
  const timeline = useMemo(() => (kycCase ? buildTimeline(kycCase) : []), [kycCase]);

  if (!canRead) {
    return (
      <ErrorState
        title="Permission required"
        description="kyc:read is required to view KYC case details."
      />
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !kycCase) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/kyc')}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to KYC
        </Button>
        <ErrorState
          description={
            detailQuery.error instanceof ApiClientError
              ? detailQuery.error.message
              : 'KYC case unavailable.'
          }
          onRetry={() => void detailQuery.refetch()}
        />
      </div>
    );
  }

  const loadingFiles = detailQuery.isPlaceholderData;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/kyc')}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back
        </Button>
        <Link to="/admin/kyc" className="text-sm text-primary hover:underline">
          All KYC cases
        </Link>
      </div>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">KYC case</p>
            <h1 className="mt-1 font-mono text-xl font-semibold text-text-primary">{kycCase.caseId}</h1>
            <p className="mt-2 text-sm text-text-secondary">
              User{' '}
              <Link
                to={`/admin/users/${kycCase.userId}`}
                className="font-mono text-xs text-primary hover:underline"
              >
                {kycCase.userId}
              </Link>
            </p>
          </div>
          <StatusBadge status={kycCase.status} />
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Current status</dt>
            <dd className="mt-1 text-sm text-text-primary">{kycCase.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Rejection reason</dt>
            <dd className="mt-1 text-sm text-text-primary">{kycCase.rejectionReason || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Created</dt>
            <dd className="mt-1 text-sm text-text-primary">{formatDateTime(kycCase.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Last updated</dt>
            <dd className="mt-1 text-sm text-text-primary">{formatDateTime(kycCase.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="text-base font-semibold text-text-primary">Documents</h3>
          </div>
          {loadingFiles ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : kycCase.documents.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No documents" description="No documents were uploaded for this case." />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {kycCase.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-[0.6rem] border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {formatStatusLabel(doc.documentType)}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {doc.originalFilename || doc.id} · {doc.contentType} · {formatBytes(doc.sizeBytes)}
                    </p>
                    <p className="text-xs text-text-muted">Uploaded {formatDateTime(doc.createdAt)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setPreview({
                        kind: 'document',
                        caseId: kycCase.caseId,
                        id: doc.id,
                        title: formatStatusLabel(doc.documentType),
                        filename: doc.originalFilename,
                      })
                    }
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    Preview
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="text-base font-semibold text-text-primary">Selfie</h3>
          </div>
          {loadingFiles ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : !kycCase.selfie ? (
            <div className="mt-4">
              <EmptyState title="No selfie" description="No selfie was uploaded for this case." />
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[0.6rem] border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {kycCase.selfie.originalFilename || kycCase.selfie.id}
                </p>
                <p className="text-xs text-text-muted">
                  {kycCase.selfie.contentType} · {formatBytes(kycCase.selfie.sizeBytes)}
                </p>
                <p className="text-xs text-text-muted">
                  Uploaded {formatDateTime(kycCase.selfie.createdAt)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPreview({
                    kind: 'selfie',
                    caseId: kycCase.caseId,
                    id: kycCase.selfie!.id,
                    title: 'Selfie',
                    filename: kycCase.selfie!.originalFilename,
                  })
                }
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Preview
              </Button>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Review decision</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Allowed targets: SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED. Rejection requires a reason.
        </p>

        {!canReview ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="kyc:review is required to submit a KYC decision."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Select
              label="New status"
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value as KycReviewStatus)}
            >
              {reviewOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <label className="block space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-text-secondary">
                Rejection reason {rejectionRequired ? '(required)' : '(cleared unless rejecting)'}
              </span>
              <textarea
                value={reasonDraft}
                onChange={(event) => setReasonDraft(event.target.value)}
                maxLength={500}
                rows={3}
                disabled={!rejectionRequired}
                placeholder={
                  rejectionRequired
                    ? 'Explain why this case is rejected…'
                    : 'Only used when status is REJECTED'
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-secondary/50 disabled:opacity-60"
              />
              {rejectionRequired && !rejectionValid ? (
                <span className="block text-xs text-danger">A rejection reason is required.</span>
              ) : null}
            </label>
            <div className="md:col-span-2">
              <Button
                disabled={!rejectionValid || reviewMutation.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                Review & confirm
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text-primary">Timeline</h3>
          {canAudit ? (
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                to={`/admin/audit?entity=KycCase&userRef=${encodeURIComponent(kycCase.userId)}`}
                className="text-primary hover:underline"
              >
                Review audit trail →
              </Link>
              <Link
                to="/admin/audit?entity=KycCase"
                className="text-primary hover:underline"
              >
                All KYC audit events →
              </Link>
            </div>
          ) : (
            <Badge tone="neutral">Audit trail access required</Badge>
          )}
        </div>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">No timestamps were returned for this case.</p>
        ) : (
          <ol className="mt-4 space-y-4 border-l border-border pl-5">
            {timeline.map((event) => (
              <li key={event.key} className="relative">
                <span
                  className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ${TIMELINE_DOT[event.tone]}`}
                  aria-hidden
                />
                <p className="text-sm font-medium text-text-primary">{event.title}</p>
                <p className="text-xs text-text-muted">{formatDateTime(event.at)}</p>
                {event.detail ? (
                  <p className="mt-1 text-xs text-text-secondary">{event.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-text-muted">
          Built from case timestamps and uploads. Reviewer identity and intermediate status changes
          live in the audit log.
        </p>
      </section>

      <KycPreviewDrawer target={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm KYC review"
        description={`Set case ${kycCase.caseId} to ${statusDraft}? This decision will be saved and recorded in the audit log.`}
        confirmLabel="Submit review"
        tone="danger"
        busy={reviewMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => reviewMutation.mutate()}
      >
        {rejectionRequired ? (
          <p className="rounded-lg border border-border bg-surface-secondary/50 p-3 text-sm text-text-secondary">
            Reason: {reasonDraft.trim()}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
