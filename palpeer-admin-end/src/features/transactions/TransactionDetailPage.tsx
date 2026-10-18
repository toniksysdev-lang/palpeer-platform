import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockGetTransaction } from '@/mocks/transactions';
import { mockUserRecentTransactions, mockUserTransactionHistory } from '@/mocks/users';
import {
  getAdminTransaction,
  getAdminUserRecentTransactions,
  getAdminUserTransactionHistory,
} from '@/services/api/transactions';
import { ApiClientError } from '@/types/api';
import type { TransactionItem } from '@/types/users';

async function findInUserFeeds(
  id: string,
  userId: string,
  typeHint: string,
): Promise<TransactionItem | null> {
  const matches = (row: TransactionItem) => row.id === id && (!typeHint || row.type === typeHint);
  if (appConfig.useMockApi) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return (
      mockUserRecentTransactions(userId).find(matches) ??
      mockUserTransactionHistory(userId).items.find(matches) ??
      null
    );
  }
  const [recent, history] = await Promise.all([
    getAdminUserRecentTransactions(userId, 50),
    getAdminUserTransactionHistory(userId, { type: typeHint || undefined, page: 0, size: 50 }),
  ]);
  return recent.find(matches) ?? history.items.find(matches) ?? null;
}

export function TransactionDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get('userId') ?? '';
  const type = searchParams.get('type') ?? '';
  const navigate = useNavigate();
  const { can } = useAuth();
  const allowed = can('transactions:read');

  const query = useQuery({
    queryKey: ['admin-transaction', type, id, userIdParam, appConfig.useMockApi],
    enabled: allowed && Boolean(id) && Boolean(type || userIdParam),
    queryFn: async () => {
      if (type) {
        if (!appConfig.useMockApi) {
          return getAdminTransaction(type, id);
        }
        try {
          await new Promise((resolve) => setTimeout(resolve, 120));
          return mockGetTransaction(type, id);
        } catch (error) {
          if (!userIdParam) throw error;
        }
      }
      const found = await findInUserFeeds(id, userIdParam, type);
      if (!found) {
        throw new ApiClientError(
          404,
          'RESOURCE_NOT_FOUND',
          'This id was not present in the recent/history pages returned for that user.',
        );
      }
      return found;
    },
  });

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="transactions:read is required to view transaction detail."
      />
    );
  }

  if (!type && !userIdParam) {
    return (
      <ErrorState
        title="Transaction type required"
        description="Open this page with ?type=FUNDING|WITHDRAWAL|EXCHANGE|TRANSFER (or a legacy ?userId=) from the transactions list."
      />
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const tx = query.data;

  if (query.isError || !tx) {
    return (
      <ErrorState
        title="Transaction not found"
        description={
          query.error instanceof ApiClientError ? query.error.message : 'Failed to load transaction.'
        }
        onRetry={() => void query.refetch()}
      />
    );
  }

  const userId = tx.userId ?? userIdParam;
  const backPath = userId
    ? `/admin/transactions?userId=${encodeURIComponent(userId)}`
    : '/admin/transactions';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold text-text-primary">{tx.type}</h1>
            <StatusBadge status={tx.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-text-muted">{tx.id}</p>
        </div>
      </div>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">User Email</dt>
            <dd className="mt-1 break-all text-xs">
              {tx.userEmail?.trim() || userId || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Amount</dt>
            <dd className="mt-1 text-sm">
              {formatDecimal(tx.amount)} {tx.currencyCode}
            </dd>
          </div>
          {tx.secondaryAmount != null ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Secondary amount</dt>
              <dd className="mt-1 text-sm">
                {formatDecimal(tx.secondaryAmount)} {tx.secondaryCurrencyCode}
              </dd>
            </div>
          ) : null}
          {tx.appliedRate != null ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Applied rate</dt>
              <dd className="mt-1 text-sm">{formatDecimal(tx.appliedRate)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              {tx.type === 'TRANSFER' ? 'Source wallet' : 'Wallet'}
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">
              {tx.walletId && can('wallets:read') ? (
                <Link to={`/admin/wallets/${tx.walletId}`} className="text-primary hover:underline">
                  {tx.walletId}
                </Link>
              ) : (
                tx.walletId || '—'
              )}
            </dd>
          </div>
          {tx.secondaryWalletId ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">
                {tx.type === 'TRANSFER' ? 'Destination wallet' : 'Secondary wallet'}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {tx.type === 'TRANSFER' && can('wallets:read') ? (
                  <Link
                    to={`/admin/wallets/${tx.secondaryWalletId}`}
                    className="text-primary hover:underline"
                  >
                    {tx.secondaryWalletId}
                  </Link>
                ) : (
                  tx.secondaryWalletId
                )}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Created</dt>
            <dd className="mt-1 text-sm">{formatDateTime(tx.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Updated</dt>
            <dd className="mt-1 text-sm">{formatDateTime(tx.updatedAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-text-muted">Ledger entry IDs</dt>
            <dd className="mt-1 break-all font-mono text-xs">
              {tx.ledgerEntryIds && Object.keys(tx.ledgerEntryIds).length
                ? Object.entries(tx.ledgerEntryIds)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(', ')
                : '—'}
            </dd>
          </div>
          {tx.failureReason ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-text-muted">
                {tx.type === 'TRANSFER' ? 'Note' : 'Failure reason'}
              </dt>
              <dd
                className={`mt-1 text-sm ${tx.type === 'TRANSFER' ? 'text-text-primary' : 'text-danger'}`}
              >
                {tx.failureReason}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {userId && can('users:read') ? (
        <Link to={`/admin/users/${encodeURIComponent(userId)}`} className="text-sm text-primary hover:underline">
          Open user profile →
        </Link>
      ) : null}
    </div>
  );
}
