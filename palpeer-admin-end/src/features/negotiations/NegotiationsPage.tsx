import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import {
  AUTO_REFRESH_INTERVAL_MS,
  AutoRefreshControl,
} from '@/components/data-display/AutoRefreshControl';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { mockListNegotiations } from '@/mocks/negotiations';
import { listAdminNegotiations } from '@/services/api/negotiations';
import type { NegotiationSummary } from '@/types/negotiations';
import { ApiClientError } from '@/types/api';

export function NegotiationsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('negotiations:read');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;
  const [autoRefresh, setAutoRefresh] = useState(false);

  const query = useQuery({
    queryKey: ['admin-negotiations', page, size, appConfig.useMockApi],
    enabled: allowed,
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL_MS : false,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return mockListNegotiations({ page, size });
      }
      return listAdminNegotiations({ page, size });
    },
  });

  const columns = useMemo<DataColumn<NegotiationSummary>[]>(
    () => [
      {
        id: 'id',
        header: 'Negotiation',
        cell: (row) => <span className="font-mono text-[11px]">{row.id}</span>,
      },
      {
        id: 'request',
        header: 'P2P request',
        cell: (row) => (
          <Link
            to={`/admin/p2p/${row.p2pRequestId}?kind=request`}
            className="font-mono text-xs text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.p2pRequestId}
          </Link>
        ),
      },
      {
        id: 'parties',
        header: 'Participants',
        cell: (row) => (
          <span className="font-mono text-[11px] text-text-secondary">
            {row.requesterId} · {row.counterpartyId}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'offers',
        header: 'Offers',
        cell: (row) => row.offers?.length ?? 0,
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
              navigate(`/admin/negotiations/${row.id}`);
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
        description="negotiations:read is required to view negotiation inventory."
      />
    );
  }

  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load negotiations.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Negotiations</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Price negotiations between users on P2P requests. Turn on auto-refresh to reload this
              list every 15 seconds.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-xs">
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
          <AutoRefreshControl
            enabled={autoRefresh}
            onToggle={setAutoRefresh}
            updatedAt={query.dataUpdatedAt}
            fetching={query.isFetching}
            onRefresh={() => void query.refetch()}
          />
        </div>
      </section>

      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={errorMessage}
        onRetry={() => void query.refetch()}
        emptyTitle="No negotiations"
        emptyDescription="No negotiations were returned for this page."
        onRowClick={(row) => navigate(`/admin/negotiations/${row.id}`)}
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
