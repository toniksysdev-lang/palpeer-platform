import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ContractPendingState } from '@/components/feedback/ContractPendingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockGetWallet, mockWalletTransactions } from '@/mocks/wallets';
import { getAdminWallet, listAdminWalletTransactions } from '@/services/api/wallets';
import type { LedgerTransactionSummary } from '@/types/wallets';
import { ApiClientError } from '@/types/api';

export function WalletDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('wallets:read');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const walletQuery = useQuery({
    queryKey: ['admin-wallet', id, appConfig.useMockApi],
    enabled: Boolean(id) && allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockGetWallet(id);
      }
      return getAdminWallet(id);
    },
  });

  const txQuery = useQuery({
    queryKey: ['admin-wallet-tx', id, page, size, appConfig.useMockApi],
    enabled: Boolean(id) && allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockWalletTransactions(id, { page, size });
      }
      return listAdminWalletTransactions(id, { page, size });
    },
  });

  const txColumns = useMemo<DataColumn<LedgerTransactionSummary>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'When',
        cell: (row) => formatDateTime(row.createdAt),
      },
      {
        id: 'entryType',
        header: 'Type',
        cell: (row) => <Badge tone="neutral">{row.entryType}</Badge>,
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => (
          <span className="font-mono text-xs">
            {formatDecimal(row.amount)} {row.currencyCode}
          </span>
        ),
      },
      {
        id: 'availableAfter',
        header: 'Available after',
        cell: (row) => (
          <span className="font-mono text-xs">{formatDecimal(row.availableBalanceAfter)}</span>
        ),
      },
      {
        id: 'reference',
        header: 'Reference',
        cell: (row) => (
          <span className="text-xs text-text-secondary">
            {row.referenceType || '—'}
            {row.referenceId ? ` · ${row.referenceId}` : ''}
          </span>
        ),
      },
    ],
    [],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="wallets:read is required to view wallet detail."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/wallets')}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back
        </Button>
        <Link to="/admin/wallets" className="text-sm text-primary hover:underline">
          All wallets
        </Link>
      </div>

      {walletQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : null}

      {walletQuery.isError ? (
        <ErrorState
          description={
            walletQuery.error instanceof ApiClientError
              ? walletQuery.error.message
              : 'Failed to load wallet.'
          }
          onRetry={() => void walletQuery.refetch()}
        />
      ) : null}

      {walletQuery.data ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Wallet</p>
              <h1 className="mt-1 font-mono text-xl font-semibold text-text-primary">
                {walletQuery.data.id}
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                User{' '}
                <Link
                  to={`/admin/users/${walletQuery.data.userId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {walletQuery.data.userId}
                </Link>
              </p>
            </div>
            <Badge tone="primary">{walletQuery.data.currencyCode}</Badge>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">Available balance</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold text-text-primary">
                {formatDecimal(walletQuery.data.availableBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Pending balance</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold text-text-secondary">
                {formatDecimal(walletQuery.data.pendingBalance)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-text-muted">
            Display-only formatting. No client-side balance arithmetic is performed.
          </p>
        </section>
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Ledger transactions</h3>
        <div className="mt-4">
          <DataTable
            columns={txColumns}
            rows={txQuery.data?.content ?? []}
            rowKey={(row) => row.id}
            loading={txQuery.isLoading}
            error={
              txQuery.error instanceof ApiClientError
                ? txQuery.error.message
                : txQuery.error
                  ? 'Failed to load ledger transactions.'
                  : null
            }
            onRetry={() => void txQuery.refetch()}
            emptyTitle="No ledger rows"
            emptyDescription="No ledger transactions were returned for this wallet."
          />
          {txQuery.data ? (
            <Pagination
              className="mt-4"
              page={txQuery.data.number}
              totalPages={txQuery.data.totalPages}
              totalElements={txQuery.data.totalElements}
              onPageChange={(nextPage) => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(nextPage));
                setSearchParams(next);
              }}
            />
          ) : null}
        </div>
      </section>

      <ContractPendingState
        title="Funding / withdrawal admin actions"
        description="Admin-initiated funding, withdrawals, and balance adjustments are not available yet."
      />
    </div>
  );
}
