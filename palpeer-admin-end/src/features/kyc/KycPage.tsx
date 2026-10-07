import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatStatusLabel } from '@/lib/format';
import { mockListKycCases } from '@/mocks/kyc';
import { listKycCases } from '@/services/api/kyc';
import type { KycCaseSummary } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import { KYC_STATUSES } from '@/types/kyc';

const STATUS_TABS = ['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;

export function KycPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;
  const status = searchParams.get('status') ?? '';
  const userId = searchParams.get('userId') ?? '';

  const [userIdDraft, setUserIdDraft] = useState(userId);

  useEffect(() => {
    setUserIdDraft(userId);
  }, [userId]);

  const allowed = can('kyc:read');

  const query = useQuery({
    queryKey: ['admin-kyc', page, size, status, userId, appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      const params = {
        page,
        size,
        status: status || undefined,
        userId: userId || undefined,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockListKycCases(params);
      }
      return listKycCases(params);
    },
  });

  function setStatus(nextStatus: string) {
    const next = new URLSearchParams(searchParams);
    if (nextStatus) next.set('status', nextStatus);
    else next.delete('status');
    next.set('page', '0');
    setSearchParams(next);
  }

  function applyUserFilter(event?: FormEvent) {
    event?.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (userIdDraft.trim()) next.set('userId', userIdDraft.trim());
    else next.delete('userId');
    next.set('page', '0');
    setSearchParams(next);
  }

  const columns = useMemo<DataColumn<KycCaseSummary>[]>(
    () => [
      {
        id: 'caseId',
        header: 'Case',
        cell: (row) => (
          <div className="min-w-[10rem]">
            <p className="font-mono text-xs text-text-primary">{row.caseId}</p>
          </div>
        ),
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
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'rejectionReason',
        header: 'Rejection reason',
        cell: (row) => (
          <span className="line-clamp-2 max-w-xs text-xs text-text-secondary">
            {row.rejectionReason || '—'}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: (row) => <span className="text-xs text-text-muted">{formatDateTime(row.createdAt)}</span>,
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        cell: (row) => <span className="text-xs text-text-muted">{formatDateTime(row.updatedAt)}</span>,
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
              navigate(`/admin/kyc/${row.caseId}`, { state: { case: row } });
            }}
          >
            Review
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
        description="kyc:read is required to view the KYC module."
      />
    );
  }

  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load KYC cases.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">KYC cases</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Review identity verification cases. Open a case to review documents and selfie.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="KYC status">
          {STATUS_TABS.map((value) => (
            <Button
              key={value || 'all'}
              role="tab"
              aria-selected={status === value}
              variant={status === value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatus(value)}
            >
              {value ? formatStatusLabel(value) : 'All'}
            </Button>
          ))}
        </div>

        <form
          className="mt-4 grid items-end gap-3 md:grid-cols-[12rem_1fr_auto_10rem]"
          onSubmit={applyUserFilter}
        >
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {KYC_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Input
            label="User ID"
            value={userIdDraft}
            onChange={(event) => setUserIdDraft(event.target.value)}
            placeholder="UUID"
          />
          <div className="flex gap-2">
            <Button type="submit">
              <Search className="h-3.5 w-3.5" aria-hidden />
              Apply
            </Button>
            {userId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('userId');
                  next.set('page', '0');
                  setSearchParams(next);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
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
        </form>
      </section>

      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.caseId}
        loading={query.isLoading}
        error={errorMessage}
        onRetry={() => void query.refetch()}
        emptyTitle="No KYC cases"
        emptyDescription={
          status || userId
            ? 'No cases match the current filters.'
            : 'When users submit verification, cases will appear here.'
        }
        onRowClick={(row) => navigate(`/admin/kyc/${row.caseId}`, { state: { case: row } })}
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
