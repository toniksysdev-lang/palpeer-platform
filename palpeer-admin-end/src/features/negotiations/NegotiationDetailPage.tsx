import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockGetNegotiation } from '@/mocks/negotiations';
import { getAdminNegotiation } from '@/services/api/negotiations';
import { ApiClientError } from '@/types/api';

export function NegotiationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const allowed = can('negotiations:read');

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

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="negotiations:read is required to view negotiation detail."
      />
    );
  }

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
    </div>
  );
}
