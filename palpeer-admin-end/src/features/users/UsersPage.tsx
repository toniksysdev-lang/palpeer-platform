import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { mockListUsers } from '@/mocks/users';
import { listAdminUsers } from '@/services/api/users';
import type { AdminUserSummary } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import { USER_STATUSES } from '@/types/users';

export function UsersPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;
  const sort = searchParams.get('sort') ?? 'createdAt,desc';
  const email = searchParams.get('email') ?? '';
  const status = searchParams.get('status') ?? '';

  const [emailDraft, setEmailDraft] = useState(email);
  const [statusDraft, setStatusDraft] = useState(status);

  useEffect(() => {
    setEmailDraft(email);
    setStatusDraft(status);
  }, [email, status]);

  const allowed = can('users:read');

  const query = useQuery({
    queryKey: ['admin-users', page, size, sort, email, status, appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      const params = {
        page,
        size,
        sort,
        email: email || undefined,
        status: status || undefined,
      };
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 250));
        return mockListUsers(params);
      }
      return listAdminUsers(params);
    },
  });

  function applyFilters(event?: FormEvent) {
    event?.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (emailDraft.trim()) next.set('email', emailDraft.trim());
    else next.delete('email');
    if (statusDraft) next.set('status', statusDraft);
    else next.delete('status');
    next.set('page', '0');
    setSearchParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    next.delete('email');
    next.delete('status');
    next.set('page', '0');
    setSearchParams(next);
  }

  const columns = useMemo<DataColumn<AdminUserSummary>[]>(
    () => [
      {
        id: 'email',
        header: 'Email',
        cell: (row) => (
          <div className="min-w-[12rem]">
            <p className="font-medium text-text-primary">{row.email}</p>
            <p className="font-mono text-[11px] text-text-muted">{row.id}</p>
          </div>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        cell: (row) => row.phone || '—',
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'enabled',
        header: 'Enabled',
        cell: (row) => (
          <Badge tone={row.enabled ? 'success' : 'danger'}>{row.enabled ? 'Yes' : 'No'}</Badge>
        ),
      },
      {
        id: 'verified',
        header: 'Verified',
        cell: (row) => (
          <span className="text-xs text-text-secondary">
            E:{row.emailVerified ? '✓' : '—'} · P:{row.phoneVerified ? '✓' : '—'}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Registered',
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
              navigate(`/admin/users/${row.id}`);
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
        description="users:read is required to view the users module."
      />
    );
  }

  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load users.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">App users</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Customers of the Palpeer app. Operator accounts are managed under{' '}
              <Link to="/admin/admins" className="text-primary hover:underline">
                Admins
              </Link>
              .
            </p>
          </div>
        </div>

        <form
          className="mt-4 grid items-end gap-3 md:grid-cols-[1fr_12rem_auto]"
          onSubmit={applyFilters}
        >
          <Input
            label="Email contains"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            placeholder="name@example.com"
          />
          <Select
            label="Status"
            value={statusDraft}
            onChange={(event) => setStatusDraft(event.target.value)}
          >
            <option value="">All statuses</option>
            {USER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit">
              <Search className="h-3.5 w-3.5" aria-hidden />
              Apply
            </Button>
            {email || status ? (
              <Button type="button" variant="secondary" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
        </form>

        <div className="mt-3 grid gap-3 md:grid-cols-[12rem_12rem]">
          <Select
            label="Sort"
            value={sort}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set('sort', event.target.value);
              next.set('page', '0');
              setSearchParams(next);
            }}
          >
            <option value="createdAt,desc">Newest first</option>
            <option value="createdAt,asc">Oldest first</option>
            <option value="email,asc">Email A–Z</option>
            <option value="email,desc">Email Z–A</option>
          </Select>
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
        emptyTitle="No users"
        emptyDescription="No platform users were returned for this page."
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
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

      <p className="text-xs text-text-muted">
        Tip: open a row for profile controls and per-user transactions.{' '}
        <Link to="/admin/dashboard" className="text-primary hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
