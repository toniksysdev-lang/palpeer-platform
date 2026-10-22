import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockGetNegotiation } from '@/mocks/negotiations';
import {
  adminAcceptNegotiation,
  adminCancelNegotiation,
  getAdminNegotiation,
} from '@/services/api/negotiations';
import { ApiClientError } from '@/types/api';

type AdminAction = 'cancel' | 'accept' | null;

export function NegotiationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const allowed = can('negotiations:read');
  const canWrite = can('negotiations:write');
  const [confirmAction, setConfirmAction] = useState<AdminAction>(null);

  const query = useQuery({
    queryKey: ['admin-negotiation', id, appConfig.useMockApi],
    enabled: Boolean(id) && allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockGetNegotiation(id);
      }
      return getAdminNegotiation(id);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (action: Exclude<AdminAction, null>) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const current = query.data ?? mockGetNegotiation(id);
        return {
          ...current,
          status: action === 'cancel' ? 'CANCELLED' : 'ACCEPTED',
        };
      }
      return action === 'cancel'
        ? adminCancelNegotiation(id)
        : adminAcceptNegotiation(id);
    },
    onSuccess: async (updated, action) => {
      setConfirmAction(null);
      push({
        tone: 'success',
        title: action === 'cancel' ? 'Negotiation cancelled' : 'Negotiation accepted',
        description:
          action === 'cancel'
            ? 'The negotiation was force-cancelled.'
            : 'The current offer was force-accepted and a P2P order was created.',
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-negotiation', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-negotiations'] });
      queryClient.setQueryData(['admin-negotiation', id, appConfig.useMockApi], updated);
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Action failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="negotiations:read is required to view negotiation detail."
      />
    );
  }

  const isOpen = query.data?.status === 'OPEN';
  const hasPendingOffer = Boolean(query.data?.currentOfferId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/negotiations')}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back
        </Button>
        <Link to="/admin/negotiations" className="text-sm text-primary hover:underline">
          All negotiations
        </Link>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {query.isError ? (
        <ErrorState
          description={
            query.error instanceof ApiClientError
              ? query.error.message
              : 'Failed to load negotiation.'
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.data ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Negotiation
              </p>
              <h1 className="mt-1 font-mono text-xl font-semibold text-text-primary">
                {query.data.id}
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                Request{' '}
                <Link
                  to={`/admin/p2p/${query.data.p2pRequestId}?kind=request`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {query.data.p2pRequestId}
                </Link>
              </p>
            </div>
            <StatusBadge status={query.data.status} />
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">Requester</dt>
              <dd className="mt-1">
                <Link
                  to={`/admin/users/${query.data.requesterId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {query.data.requesterId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Counterparty</dt>
              <dd className="mt-1">
                <Link
                  to={`/admin/users/${query.data.counterpartyId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {query.data.counterpartyId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Current offer</dt>
              <dd className="mt-1 font-mono text-xs">{query.data.currentOfferId || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Created</dt>
              <dd className="mt-1 text-sm">{formatDateTime(query.data.createdAt)}</dd>
            </div>
          </dl>

          <h3 className="mt-6 text-sm font-semibold text-text-primary">Offers</h3>
          {(query.data.offers?.length ?? 0) === 0 ? (
            <div className="mt-3">
              <EmptyState title="No offers" description="No offer history on this negotiation." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-[0.6rem] border border-border">
              {query.data.offers!.map((offer) => (
                <li key={offer.id ?? `${offer.createdAt}-${offer.rate}`} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs">
                      {formatDecimal(offer.amount)} @ {formatDecimal(offer.rate)}
                    </span>
                    <span className="text-xs text-text-muted">{formatDateTime(offer.createdAt)}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-text-secondary">
                    by {offer.offeredBy || '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Admin actions</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Force-cancel an open negotiation, or force-accept the current pending offer (creates the
          P2P order as the counterparty).
        </p>
        {!canWrite ? (
          <div className="mt-4">
            <Badge tone="warning">negotiations:write is required for interventions</Badge>
          </div>
        ) : !query.data ? null : !isOpen ? (
          <p className="mt-4 text-sm text-text-muted">
            This negotiation is {query.data.status}. No further admin actions are available.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={actionMutation.isPending}
              onClick={() => setConfirmAction('cancel')}
            >
              Force cancel
            </Button>
            <Button
              disabled={actionMutation.isPending || !hasPendingOffer}
              onClick={() => setConfirmAction('accept')}
              title={!hasPendingOffer ? 'Requires a current pending offer' : undefined}
            >
              Force accept offer
            </Button>
            {!hasPendingOffer ? (
              <p className="w-full text-xs text-text-muted">
                Force accept needs a current pending offer on this negotiation.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmAction === 'cancel'}
        title="Force-cancel negotiation?"
        description="Participants will no longer be able to counter or accept. Chat history remains readable."
        confirmLabel="Cancel negotiation"
        tone="danger"
        busy={actionMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => actionMutation.mutate('cancel')}
      />
      <ConfirmDialog
        open={confirmAction === 'accept'}
        title="Force-accept current offer?"
        description="This accepts the pending offer as the counterparty and creates a settled P2P order."
        confirmLabel="Accept offer"
        tone="primary"
        busy={actionMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => actionMutation.mutate('accept')}
      />
    </div>
  );
}
