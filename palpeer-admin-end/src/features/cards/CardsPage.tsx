import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { formatMaskedPan, mockListCards } from '@/mocks/cards';
import { listAdminCards } from '@/services/api/cards';
import type { CardSummary } from '@/types/cards';
import { ApiClientError } from '@/types/api';

export function CardsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('cards:read');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const query = useQuery({
    queryKey: ['admin-cards', page, size, appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return mockListCards({ page, size });
      }
      return listAdminCards({ page, size });
    },
  });

  const columns = useMemo<DataColumn<CardSummary>[]>(
    () => [
      {
        id: 'masked',
        header: 'Card',
        cell: (row) => (
          <div>
            <p className="font-mono text-sm">{formatMaskedPan(row.lastFour)}</p>
            <p className="text-xs text-text-muted">
              {row.brand || 'CARD'} · {row.currencyCode}
            </p>
          </div>
        ),
      },
      {
        id: 'cardholder',
        header: 'Cardholder',
        cell: (row) => row.cardholderName || '—',
      },
      {
        id: 'wallet',
        header: 'Wallet',
        cell: (row) => (
          <Link
            to={`/admin/wallets/${row.walletId}`}
            className="font-mono text-xs text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.walletId}
          </Link>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: (row) => formatDateTime(row.createdAt),
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
              navigate(`/admin/cards/${row.id}`);
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
        description="cards:read is required to view card inventory."
      />
    );
  }

  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load cards.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Cards</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              All customer cards. Only masked card numbers (last four digits) are shown — never the
              full card number or CVV. Use the wallet link to find the card owner.
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
        emptyTitle="No cards"
        emptyDescription="No cards were returned for this page."
        onRowClick={(row) => navigate(`/admin/cards/${row.id}`)}
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
