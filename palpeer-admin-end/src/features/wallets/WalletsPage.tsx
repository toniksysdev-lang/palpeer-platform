import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDecimal } from '@/lib/format';
import { mockListWallets } from '@/mocks/wallets';
import { listAdminWallets } from '@/services/api/wallets';
import type { WalletSummary } from '@/types/wallets';
import { ApiClientError } from '@/types/api';

export function WalletsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('wallets:read');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const query = useQuery({
    queryKey: ['admin-wallets', page, size, appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockListWallets({ page, size });
      }
      return listAdminWallets({ page, size });
    },
  });

  const columns = useMemo<DataColumn<WalletSummary>[]>(
    () => [
      {
        id: 'id',
        header: 'Wallet',
        cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
      },
      {
        id: 'userId',
        header: 'User',
        cell: (row) => (
          <Link
            to={`/admin/users/${row.userId}`}
            className="font-mono text-xs text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.userId}
          </Link>
        ),
      },
      {
        id: 'currency',
        header: 'Currency',
        cell: (row) => <Badge tone="primary">{row.currencyCode}</Badge>,
      },
      {
        id: 'available',
        header: 'Available',
        cell: (row) => (
          <span className="font-mono text-sm">{formatDecimal(row.availableBalance)}</span>
        ),
      },
      {
        id: 'pending',
        header: 'Pending',
        cell: (row) => (
          <span className="font-mono text-sm text-text-secondary">
            {formatDecimal(row.pendingBalance)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/admin/wallets/${row.id}`);
            }}
          >
            Open
          </Button>
        ),
      },
    ],
    [navigate],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="wallets:read is required to view wallet inventory."
      />
    );
  }

  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load wallets.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Wallets</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              All customer wallets and their balances.
            </p>
          </div>
        </div>

        <div className="mt-4 max-w-xs">
          <Select
            label="Page size"
            value={String(size)}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set('size', event.target.value);
              next.set('page', '0');
              setSearchParams(next);
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </Select>
        </div>
      </section>

      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={errorMessage}
        onRetry={() => void query.refetch()}
        emptyTitle="No wallets"
        emptyDescription="No wallets were returned for this page."
        onRowClick={(row) => navigate(`/admin/wallets/${row.id}`)}
      />

      {query.data ? (
        <Pagination
          page={query.data.number}
          totalPages={query.data.totalPages}
          totalElements={query.data.totalElements}
          onPageChange={(nextPage) => {
            const next = new URLSearchParams(searchParams);
            next.set('page', String(nextPage));
            setSearchParams(next);
          }}
        />
      ) : null}
    </div>
  );
}
