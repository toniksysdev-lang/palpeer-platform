import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Gift } from 'lucide-react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockGetAdminReferral, mockListAdminBonuses } from '@/mocks/promotions';
import { getAdminReferral, listAdminBonuses } from '@/services/api/promotions';
import { ApiClientError } from '@/types/api';
import type { BonusSummary } from '@/types/promotions';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'COMPLETED':
    case 'GRANTED':
      return 'success';
    case 'OPEN':
    case 'PENDING':
      return 'warning';
    case 'CANCELLED':
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function UserLink({ userId, canRead }: { userId?: string | null; canRead: boolean }) {
  if (!userId) return <span className="font-mono text-xs">—</span>;
  if (!canRead) return <span className="break-all font-mono text-xs">{userId}</span>;
  return (
    <Link
      to={`/admin/users/${userId}`}
      className="break-all font-mono text-xs text-primary hover:underline"
    >
      {userId}
    </Link>
  );
}

export function ReferralDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const allowed = can('promotions:write');
  const canUsers = can('users:read');

  const detailQuery = useQuery({
    queryKey: ['admin-referral', id, appConfig.useMockApi],
    enabled: allowed && Boolean(id),
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return mockGetAdminReferral(id);
      }
      return getAdminReferral(id);
    },
  });

  const bonusesQuery = useQuery({
    queryKey: ['admin-bonuses-by-referral', id, appConfig.useMockApi],
    enabled: allowed && Boolean(id),
    queryFn: async () => {
      const params = { referralId: id, page: 0, size: 50 };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return mockListAdminBonuses(params);
      }
      return listAdminBonuses(params);
    },
  });

  const bonusColumns = useMemo<DataColumn<BonusSummary>[]>(
    () => [
      {
        id: 'userId',
        header: 'User',
        cell: (row) => <UserLink userId={row.userId} canRead={canUsers} />,
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => (
          <span>
            {formatDecimal(row.amount)} {row.currencyCode}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <Badge tone={statusTone(String(row.status))}>{row.status}</Badge>,
      },
      {
        id: 'reason',
        header: 'Reason',
        cell: (row) => row.reason || '—',
      },
    ],
    [canUsers],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="promotions:write is required to view referral detail."
      />
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Referral not found"
        description={
          detailQuery.error instanceof ApiClientError
            ? detailQuery.error.message
            : 'Could not load this referral.'
        }
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const referral = detailQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">{referral.referralCode}</h1>
              <Badge tone={statusTone(String(referral.status))}>{referral.status}</Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-text-muted">{referral.id}</p>
          </div>
        </div>
        <Link
          to={`/admin/referrals?tab=bonuses&referralId=${encodeURIComponent(referral.id)}`}
          className="text-sm text-primary hover:underline"
        >
          Filter bonuses →
        </Link>
      </div>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Referrer</dt>
            <dd className="mt-1">
              <UserLink userId={referral.referrerUserId} canRead={canUsers} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Referee</dt>
            <dd className="mt-1">
              <UserLink userId={referral.refereeUserId} canRead={canUsers} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Promotion</dt>
            <dd className="mt-1 break-all font-mono text-xs">{referral.promotionId || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Created</dt>
            <dd className="mt-1 text-sm">{formatDateTime(referral.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Linked bonuses</h3>
        {bonusesQuery.isError ? (
          <ErrorState
            description={
              bonusesQuery.error instanceof ApiClientError
                ? bonusesQuery.error.message
                : 'Failed to load bonuses.'
            }
            onRetry={() => void bonusesQuery.refetch()}
          />
        ) : (
          <DataTable
            columns={bonusColumns}
            rows={bonusesQuery.data?.content ?? []}
            rowKey={(row) => row.id}
            loading={bonusesQuery.isLoading}
            emptyTitle="No bonuses"
            emptyDescription={
              searchParams.get('focus') === 'bonuses'
                ? 'No bonuses linked to this referral yet.'
                : 'Bonuses appear after a completed apply with an active REFERRAL promotion.'
            }
          />
        )}
      </section>
    </div>
  );
}
