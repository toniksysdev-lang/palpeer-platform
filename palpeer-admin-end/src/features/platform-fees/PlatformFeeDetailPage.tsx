import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote } from 'lucide-react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { getPlatformFee } from '@/services/api/platformFees';
import { ApiClientError } from '@/types/api';

export function PlatformFeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const allowed = can('reports:read') || can('fees:read');

  const query = useQuery({
    queryKey: ['platform-fee', id, appConfig.useMockApi],
    enabled: Boolean(id) && allowed && !appConfig.useMockApi,
    queryFn: () => getPlatformFee(id!),
  });

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="reports:read or fees:read is required to view platform fee revenue."
      />
    );
  }

  if (!id) {
    return <ErrorState title="Missing id" description="No platform fee id in the URL." />;
  }

  if (query.isLoading) {
    return <p className="text-sm text-text-secondary">Loading…</p>;
  }

  if (query.error || !query.data) {
    return (
      <ErrorState
        title="Could not load fee"
        description={
          query.error instanceof ApiClientError ? query.error.message : 'Request failed.'
        }
        onRetry={() => void query.refetch()}
      />
    );
  }

  const row = query.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/platform-fees"
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to list
        </Link>
      </div>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold text-text-primary">Platform fee revenue</h1>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-text-secondary">Recorded</dt>
            <dd className="mt-1 text-sm">{formatDateTime(row.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-text-secondary">Source</dt>
            <dd className="mt-1">
              <Badge tone={row.sourceType === 'P2P' ? 'info' : 'neutral'}>{row.sourceType}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-text-secondary">Amount</dt>
            <dd className="mt-1 font-mono text-sm">
              {formatDecimal(row.amount)} {row.currencyCode}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-text-secondary">User</dt>
            <dd className="mt-1 text-sm">{row.userEmail ?? row.userId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-text-secondary">Reference type</dt>
            <dd className="mt-1 font-mono text-sm">{row.referenceType}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-text-secondary">Reference id</dt>
            <dd className="mt-1 font-mono text-sm break-all">{row.referenceId}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase text-text-secondary">Description</dt>
            <dd className="mt-1 text-sm">{row.description ?? '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
