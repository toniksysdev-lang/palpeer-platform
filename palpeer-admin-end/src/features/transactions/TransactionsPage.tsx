import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Banknote, Download, Search } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
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
import { transactionDetailPath } from '@/features/transactions/transactionPaths';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockExportTransactions, mockSearchTransactions } from '@/mocks/transactions';
import { saveBlob } from '@/services/api/client';
import {
  exportAdminTransactions,
  searchAdminTransactions,
  type AdminTransactionSearchParams,
} from '@/services/api/transactions';
import { ApiClientError } from '@/types/api';
import {
  TRANSACTION_ACTIVITY_TYPES,
  TRANSACTION_STATUSES,
  type TransactionItem,
} from '@/types/users';

function localInputToIso(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

function todayStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

export function TransactionsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('transactions:read');
  const canUsers = can('users:read');

  const userId = searchParams.get('userId')?.trim() ?? '';
  const type = searchParams.get('type') ?? '';
  const status = searchParams.get('status') ?? '';
  const currencyCode = searchParams.get('currencyCode') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const [userIdDraft, setUserIdDraft] = useState(userId);
  const [typeDraft, setTypeDraft] = useState(type);
  const [statusDraft, setStatusDraft] = useState(status);
  const [currencyDraft, setCurrencyDraft] = useState(currencyCode);
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setUserIdDraft(userId);
    setTypeDraft(type);
    setStatusDraft(status);
    setCurrencyDraft(currencyCode);
    setFromDraft(from);
    setToDraft(to);
  }, [userId, type, status, currencyCode, from, to]);

  const filters = useMemo<AdminTransactionSearchParams>(
    () => ({
      type: type || undefined,
      status: status || undefined,
      currencyCode: currencyCode || undefined,
      userId: userId || undefined,
      from: localInputToIso(from),
      to: localInputToIso(to, true),
    }),
    [type, status, currencyCode, userId, from, to],
  );

  const query = useQuery({
    queryKey: ['admin-transactions', filters, page, size, appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return mockSearchTransactions({ ...filters, page, size });
      }
      return searchAdminTransactions({ ...filters, page, size });
    },
  });

  const columns = useMemo<DataColumn<TransactionItem>[]>(
    () => [
      {
        id: 'type',
        header: 'Transaction Type',
        cell: (row) => <Badge tone="neutral">{row.type}</Badge>,
      },
      {
        id: 'id',
        header: 'Reference',
        cell: (row) => <span className="font-mono text-[11px]">{row.id}</span>,
      },
      {
        id: 'user',
        header: 'User',
        cell: (row) =>
          row.userId ? (
            canUsers ? (
              <Link
                to={`/admin/users/${row.userId}`}
                className="font-mono text-[11px] text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {row.userId}
              </Link>
            ) : (
              <span className="font-mono text-[11px]">{row.userId}</span>
            )
          ) : (
            <span className="font-mono text-[11px] text-text-muted">—</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => (
          <span className="font-mono text-xs">
            {formatDecimal(row.amount)} {row.currencyCode ?? ''}
            {row.secondaryAmount != null ? (
              <span className="block text-text-muted">
                → {formatDecimal(row.secondaryAmount)} {row.secondaryCurrencyCode ?? ''}
              </span>
            ) : null}
          </span>
        ),
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
          <Link
            to={transactionDetailPath(row, userId || undefined)}
            className="text-sm font-medium text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Open
          </Link>
        ),
      },
    ],
    [canUsers, userId],
  );

  function applyFilters(event?: FormEvent) {
    event?.preventDefault();
    const next = new URLSearchParams();
    if (typeDraft) next.set('type', typeDraft);
    if (statusDraft) next.set('status', statusDraft);
    if (currencyDraft.trim()) next.set('currencyCode', currencyDraft.trim().toUpperCase());
    if (userIdDraft.trim()) next.set('userId', userIdDraft.trim());
    if (fromDraft) next.set('from', fromDraft);
    if (toDraft) next.set('to', toDraft);
    next.set('page', '0');
    next.set('size', String(size));
    setSearchParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    next.set('size', String(size));
    setSearchParams(next);
  }

  function patchParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  async function onExport() {
    setExporting(true);
    try {
      const content = appConfig.useMockApi
        ? mockExportTransactions(filters)
        : await exportAdminTransactions(filters);
      saveBlob(content.blob, content.filename ?? `palpeer-transactions-${todayStamp()}.csv`);
      push({
        tone: 'success',
        title: 'Export ready',
        description: 'CSV downloaded (max 5,000 rows, current filters applied).',
      });
    } catch (error) {
      push({
        tone: 'error',
        title: 'Export failed',
        description: error instanceof ApiClientError ? error.message : 'Could not export transactions.',
      });
    } finally {
      setExporting(false);
    }
  }

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="transactions:read is required to view transactions."
      />
    );
  }

  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load transactions.'
        : null;

  const hasFilters = Boolean(type || status || currencyCode || userId || from || to);

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Transactions</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Platform-wide funding, withdrawal, and exchange activity, newest first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={exporting} onClick={() => void onExport()}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        </div>

        <form className="mt-4 space-y-3" onSubmit={applyFilters}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Search filters
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select
              label="Transaction Type"
              value={typeDraft}
              onChange={(event) => setTypeDraft(event.target.value)}
            >
              <option value="">All types</option>
              {TRANSACTION_ACTIVITY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value === 'FUNDING'
                    ? 'Funding'
                    : value === 'WITHDRAWAL'
                      ? 'Withdrawal'
                      : value === 'EXCHANGE'
                        ? 'Exchange'
                        : value}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
            >
              <option value="">All statuses</option>
              {TRANSACTION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Input
              label="Currency"
              value={currencyDraft}
              onChange={(event) => setCurrencyDraft(event.target.value)}
              placeholder="CAD"
              maxLength={10}
            />
            <Input
              label="User ID"
              value={userIdDraft}
              onChange={(event) => setUserIdDraft(event.target.value)}
              placeholder="Optional UUID"
            />
            <Input
              label="From"
              type="date"
              value={fromDraft}
              onChange={(event) => setFromDraft(event.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={toDraft}
              onChange={(event) => setToDraft(event.target.value)}
            />
            <Select
              label="Page size"
              value={String(size)}
              onChange={(event) => patchParams({ size: event.target.value, page: '0' })}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
            <div className="flex items-end gap-2">
              <Button type="submit">
                <Search className="h-4 w-4" aria-hidden />
                Search
              </Button>
              {hasFilters ? (
                <Button type="button" variant="secondary" onClick={clearFilters}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </section>

      {userId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
          <p>
            Filtered to user{' '}
            <Link to={`/admin/users/${userId}`} className="font-mono text-xs text-primary hover:underline">
              {userId}
            </Link>
          </p>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => `${row.type}-${row.id}`}
        loading={query.isLoading}
        error={errorMessage}
        onRetry={() => void query.refetch()}
        emptyTitle="No transactions"
        emptyDescription="No funding, withdrawal, or exchange rows match these filters."
        onRowClick={(row) => navigate(transactionDetailPath(row, userId || undefined))}
      />

      {query.data ? (
        <Pagination
          page={query.data.page}
          totalPages={query.data.totalPages}
          totalElements={query.data.totalElements}
          onPageChange={(nextPage) => patchParams({ page: String(nextPage) })}
        />
      ) : null}
    </div>
  );
}
