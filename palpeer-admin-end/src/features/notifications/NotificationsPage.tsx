import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Bell, Megaphone } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ContractPendingState } from '@/components/feedback/ContractPendingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { mockListNotifications } from '@/mocks/notifications';
import { listAdminNotifications } from '@/services/api/notifications';
import type { NotificationSummary } from '@/types/notifications';
import { ApiClientError } from '@/types/api';

export function NotificationsPage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('notifications:read');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const query = useQuery({
    queryKey: ['admin-notifications', page, size, appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockListNotifications({ page, size });
      }
      return listAdminNotifications({ page, size });
    },
  });

  const columns = useMemo<DataColumn<NotificationSummary>[]>(
    () => [
      {
        id: 'title',
        header: 'Notification',
        cell: (row) => (
          <div className="min-w-[14rem]">
            <p className="font-medium text-text-primary">{row.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{row.body || '—'}</p>
          </div>
        ),
      },
      {
        id: 'channel',
        header: 'Channel',
        cell: (row) => <Badge tone="neutral">{row.channel}</Badge>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'category',
        header: 'Category',
        cell: (row) => row.category || '—',
      },
      {
        id: 'reference',
        header: 'Reference',
        cell: (row) => (
          <span className="font-mono text-[11px] text-text-secondary">
            {row.referenceType || '—'}
            {row.referenceId ? ` · ${row.referenceId}` : ''}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: (row) => formatDateTime(row.createdAt),
      },
    ],
    [],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="notifications:read is required to view notification inventory."
      />
    );
  }

  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load notifications.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Notifications</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Notifications sent to app users. Broadcasting is not available yet.
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
        emptyTitle="No notifications"
        emptyDescription="No notifications were returned for this page."
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

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-warning" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">Broadcast / send</h3>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Sending and targeting notifications is not available yet.
        </p>
        <Button className="mt-4" disabled title="Not available yet">
          Compose broadcast (unavailable)
        </Button>
      </section>

      <ContractPendingState
        title="Templates, delivery receipts, push targeting"
        description="These tools are not available yet."
      />
    </div>
  );
}
