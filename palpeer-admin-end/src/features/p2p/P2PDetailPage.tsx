import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import {
  mockListP2POrders,
  mockListP2PRequests,
  mockUpdateP2POrderStatus,
  mockUpdateP2PRequestStatus,
} from '@/mocks/p2p';
import {
  listAdminP2POrders,
  listAdminP2PRequests,
  updateAdminP2POrderStatus,
  updateAdminP2PRequestStatus,
} from '@/services/api/p2p';
import type { P2POrderSummary, P2PRequestSummary } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import { P2P_ADMIN_STATUSES, type P2PAdminStatus } from '@/types/p2p';

type Found =
  | { kind: 'request'; row: P2PRequestSummary }
  | { kind: 'order'; row: P2POrderSummary };

export function P2PDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const kindHint = searchParams.get('kind');
  const navigate = useNavigate();
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canRead = can('p2p:read');
  const canWrite = can('p2p:write');

  const [statusDraft, setStatusDraft] = useState<P2PAdminStatus>('CANCELLED');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ['admin-p2p-requests', appConfig.useMockApi],
    enabled: canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockListP2PRequests();
      }
      return listAdminP2PRequests();
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['admin-p2p-orders', appConfig.useMockApi],
    enabled: canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockListP2POrders();
      }
      return listAdminP2POrders();
    },
  });

  const found = useMemo<Found | null>(() => {
    const request = requestsQuery.data?.find((row) => row.id === id);
    const order = ordersQuery.data?.find((row) => row.id === id);
    if (kindHint === 'order' && order) return { kind: 'order', row: order };
    if (kindHint === 'request' && request) return { kind: 'request', row: request };
    if (request) return { kind: 'request', row: request };
    if (order) return { kind: 'order', row: order };
    return null;
  }, [id, kindHint, ordersQuery.data, requestsQuery.data]);

  const statusMutation = useMutation({
    mutationFn: async () => {
      if (!found) throw new Error('missing');
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return found.kind === 'request'
          ? mockUpdateP2PRequestStatus(found.row.id, statusDraft)
          : mockUpdateP2POrderStatus(found.row.id, statusDraft);
      }
      return found.kind === 'request'
        ? updateAdminP2PRequestStatus(found.row.id, { status: statusDraft })
        : updateAdminP2POrderStatus(found.row.id, { status: statusDraft });
    },
    onSuccess: () => {
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-p2p-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-p2p-orders'] });
      push({ tone: 'success', title: 'Status updated', description: `Set to ${statusDraft}.` });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Update failed',
        description: error instanceof ApiClientError ? error.message : 'Could not update status.',
      });
    },
  });

  if (!canRead) {
    return (
      <ErrorState title="Permission required" description="p2p:read is required to view P2P detail." />
    );
  }

  if (requestsQuery.isLoading || ordersQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!found) {
    return (
      <ErrorState
        title="P2P item not found"
        description="No P2P request or order with this ID was found."
        onRetry={() => {
          void requestsQuery.refetch();
          void ordersQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/admin/p2p')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold text-text-primary">
              {found.kind === 'request' ? 'P2P request' : 'P2P order'}
            </h1>
            <StatusBadge status={found.row.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-text-muted">{found.row.id}</p>
        </div>
      </div>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        {found.kind === 'request' ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">User</dt>
              <dd className="mt-1 break-all font-mono text-xs">{found.row.userId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Side / pair</dt>
              <dd className="mt-1 text-sm">
                {found.row.side} {found.row.baseCurrencyCode}/{found.row.quoteCurrencyCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Amount</dt>
              <dd className="mt-1 text-sm">{formatDecimal(found.row.amount)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Rate</dt>
              <dd className="mt-1 text-sm">{formatDecimal(found.row.rate)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Created</dt>
              <dd className="mt-1 text-sm">{formatDateTime(found.row.createdAt)}</dd>
            </div>
            {found.row.expiresAt ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">Expires</dt>
                <dd className="mt-1 text-sm">{formatDateTime(found.row.expiresAt)}</dd>
              </div>
            ) : null}
            {found.row.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-text-muted">Notes</dt>
                <dd className="mt-1 text-sm">{found.row.notes}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Request</dt>
              <dd className="mt-1 break-all font-mono text-xs">{found.row.requestId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Requester</dt>
              <dd className="mt-1 break-all font-mono text-xs">{found.row.requesterId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Acceptor</dt>
              <dd className="mt-1 break-all font-mono text-xs">{found.row.acceptorId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Amount</dt>
              <dd className="mt-1 text-sm">{formatDecimal(found.row.amount)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Rate</dt>
              <dd className="mt-1 text-sm">{formatDecimal(found.row.rate)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Created</dt>
              <dd className="mt-1 text-sm">{formatDateTime(found.row.createdAt)}</dd>
            </div>
          </dl>
        )}
      </section>

      {canWrite ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Admin status override</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Status can be set to CANCELLED or COMPLETED only.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Select
              label="New status"
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value as P2PAdminStatus)}
            >
              {P2P_ADMIN_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Button onClick={() => setConfirmOpen(true)} disabled={statusMutation.isPending}>
              Apply status
            </Button>
          </div>
        </section>
      ) : (
        <Badge tone="warning">You don&apos;t have permission to change status</Badge>
      )}

      <Link to="/admin/p2p" className="text-sm text-primary hover:underline">
        ← Back to P2P list
      </Link>

      <ConfirmDialog
        open={confirmOpen}
        title="Update P2P status?"
        description={`Set this ${found.kind} to ${statusDraft}.`}
        confirmLabel="Update"
        tone="danger"
        busy={statusMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void statusMutation.mutateAsync()}
      />
    </div>
  );
}
