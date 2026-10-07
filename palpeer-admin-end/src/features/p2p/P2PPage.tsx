import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Scale, Search } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Drawer } from '@/components/dialogs/Drawer';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import {
  mockListP2POrders,
  mockListP2PRequests,
  mockUpdateP2POrderStatus,
  mockUpdateP2PRequestStatus,
} from '@/mocks/p2p';
import {
  listAdminP2POrders,
  listAdminP2PRequests,
  updateAdminP2POrderStatus,
  updateAdminP2PRequestStatus,
} from '@/services/api/p2p';
import type { P2POrderSummary, P2PRequestSummary } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import { P2P_ADMIN_STATUSES, type P2PAdminStatus } from '@/types/p2p';

type Tab = 'requests' | 'orders';

const P2P_PAGE_SIZE = 20;
type Selection =
  | { kind: 'request'; row: P2PRequestSummary }
  | { kind: 'order'; row: P2POrderSummary };

export function P2PPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canRead = can('p2p:read');
  const canWrite = can('p2p:write');

  const tab = (searchParams.get('tab') === 'orders' ? 'orders' : 'requests') as Tab;
  const statusFilter = searchParams.get('status') ?? '';
  const userIdFilter = searchParams.get('userId') ?? '';
  const page = Number(searchParams.get('page') ?? '0') || 0;

  const [userIdDraft, setUserIdDraft] = useState(userIdFilter);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [statusDraft, setStatusDraft] = useState<P2PAdminStatus>('CANCELLED');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setUserIdDraft(userIdFilter);
  }, [userIdFilter]);

  const filters = {
    status: statusFilter || undefined,
    userId: userIdFilter || undefined,
  };

  const requestsQuery = useQuery({
    queryKey: ['admin-p2p-requests', statusFilter, userIdFilter, appConfig.useMockApi],
    enabled: canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return mockListP2PRequests(filters);
      }
      return listAdminP2PRequests(filters);
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['admin-p2p-orders', statusFilter, userIdFilter, appConfig.useMockApi],
    enabled: canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return mockListP2POrders(filters);
      }
      return listAdminP2POrders(filters);
    },
  });

  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    next.delete('page');
    setSearchParams(next);
  }

  function applyUserFilter(event?: FormEvent) {
    event?.preventDefault();
    updateParams((next) => {
      if (userIdDraft.trim()) next.set('userId', userIdDraft.trim());
      else next.delete('userId');
    });
  }

  const statusMutation = useMutation({
    mutationFn: async () => {
      if (!selected) {
        throw new ApiClientError(400, 'NO_SELECTION', 'Nothing selected.');
      }
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (selected.kind === 'request') {
          return {
            kind: 'request' as const,
            row: mockUpdateP2PRequestStatus(selected.row.id, statusDraft),
          };
        }
        return {
          kind: 'order' as const,
          row: mockUpdateP2POrderStatus(selected.row.id, statusDraft),
        };
      }
      if (selected.kind === 'request') {
        return {
          kind: 'request' as const,
          row: await updateAdminP2PRequestStatus(selected.row.id, { status: statusDraft }),
        };
      }
      return {
        kind: 'order' as const,
        row: await updateAdminP2POrderStatus(selected.row.id, { status: statusDraft }),
      };
    },
    onSuccess: async (result) => {
      setConfirmOpen(false);
      setSelected(result);
      push({
        tone: 'success',
        title: 'P2P status updated',
        description: `Status set to ${result.row.status}.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-p2p-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-p2p-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'p2p-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'p2p-orders'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'P2P update failed',
        description: error instanceof ApiClientError ? error.message : 'Update failed.',
      });
    },
  });

  const activeRows = tab === 'requests' ? (requestsQuery.data ?? []) : (ordersQuery.data ?? []);
  const totalPages = Math.max(1, Math.ceil(activeRows.length / P2P_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pagedRequests = useMemo(
    () => (requestsQuery.data ?? []).slice(safePage * P2P_PAGE_SIZE, (safePage + 1) * P2P_PAGE_SIZE),
    [requestsQuery.data, safePage],
  );

  const pagedOrders = useMemo(
    () => (ordersQuery.data ?? []).slice(safePage * P2P_PAGE_SIZE, (safePage + 1) * P2P_PAGE_SIZE),
    [ordersQuery.data, safePage],
  );

  const requestColumns = useMemo<DataColumn<P2PRequestSummary>[]>(
    () => [
      {
        id: 'id',
        header: 'Request',
        cell: (row) => <span className="font-mono text-[11px]">{row.id}</span>,
      },
      {
        id: 'user',
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
        id: 'pair',
        header: 'Pair / side',
        cell: (row) => (
          <span className="text-sm">
            {row.side} {row.baseCurrencyCode}/{row.quoteCurrencyCode}
          </span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.amount)}</span>,
      },
      {
        id: 'rate',
        header: 'Rate',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.rate)}</span>,
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
          <Link
            to={`/admin/p2p/${row.id}?kind=request`}
            className="text-sm font-medium text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Open
          </Link>
        ),
      },
    ],
    [],
  );

  const orderColumns = useMemo<DataColumn<P2POrderSummary>[]>(
    () => [
      {
        id: 'id',
        header: 'Order',
        cell: (row) => <span className="font-mono text-[11px]">{row.id}</span>,
      },
      {
        id: 'requestId',
        header: 'Request',
        cell: (row) => (
          <Link
            to={`/admin/p2p/${row.requestId}?kind=request`}
            className="font-mono text-[11px] text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.requestId}
          </Link>
        ),
      },
      {
        id: 'parties',
        header: 'Parties',
        cell: (row) => (
          <span className="font-mono text-[11px] text-text-secondary">
            {row.requesterId} → {row.acceptorId}
          </span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.amount)}</span>,
      },
      {
        id: 'rate',
        header: 'Rate',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.rate)}</span>,
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
          <Link
            to={`/admin/p2p/${row.id}?kind=order`}
            className="text-sm font-medium text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Open
          </Link>
        ),
      },
    ],
    [],
  );

  if (!canRead) {
    return (
      <ErrorState
        title="Permission required"
        description="p2p:read is required to view P2P requests and orders."
      />
    );
  }

  const activeError =
    tab === 'requests'
      ? requestsQuery.error instanceof ApiClientError
        ? requestsQuery.error.message
        : requestsQuery.error
          ? 'Failed to load P2P requests.'
          : null
      : ordersQuery.error instanceof ApiClientError
        ? ordersQuery.error.message
        : ordersQuery.error
          ? 'Failed to load P2P orders.'
          : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">P2P</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Peer-to-peer exchange requests and orders. Admins may set{' '}
              <strong className="font-semibold text-text-primary">CANCELLED</strong> or{' '}
              <strong className="font-semibold text-text-primary">COMPLETED</strong> only.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={tab === 'requests' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => updateParams((next) => next.set('tab', 'requests'))}
          >
            Requests ({requestsQuery.data?.length ?? '—'})
          </Button>
          <Button
            variant={tab === 'orders' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => updateParams((next) => next.set('tab', 'orders'))}
          >
            Orders ({ordersQuery.data?.length ?? '—'})
          </Button>
        </div>

        <form
          className="mt-4 grid items-end gap-3 md:grid-cols-[12rem_1fr_auto]"
          onSubmit={applyUserFilter}
        >
          <Select
            label="Status"
            value={statusFilter}
            onChange={(event) =>
              updateParams((next) => {
                if (event.target.value) next.set('status', event.target.value);
                else next.delete('status');
              })
            }
          >
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
          <Input
            label="User ID"
            value={userIdDraft}
            onChange={(event) => setUserIdDraft(event.target.value)}
            placeholder={tab === 'orders' ? 'Requester or acceptor UUID' : 'Requester UUID'}
          />
          <div className="flex gap-2">
            <Button type="submit">
              <Search className="h-3.5 w-3.5" aria-hidden />
              Apply
            </Button>
            {userIdFilter ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => updateParams((next) => next.delete('userId'))}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      {tab === 'requests' ? (
        <DataTable
          columns={requestColumns}
          rows={pagedRequests}
          rowKey={(row) => row.id}
          loading={requestsQuery.isLoading}
          error={activeError}
          onRetry={() => void requestsQuery.refetch()}
          emptyTitle="No P2P requests"
          emptyDescription="No requests match the current filter."
          onRowClick={(row) => setSelected({ kind: 'request', row })}
        />
      ) : (
        <DataTable
          columns={orderColumns}
          rows={pagedOrders}
          rowKey={(row) => row.id}
          loading={ordersQuery.isLoading}
          error={activeError}
          onRetry={() => void ordersQuery.refetch()}
          emptyTitle="No P2P orders"
          emptyDescription="No orders match the current filter."
          onRowClick={(row) => setSelected({ kind: 'order', row })}
        />
      )}

      {activeRows.length > P2P_PAGE_SIZE ? (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalElements={activeRows.length}
          onPageChange={(nextPage) => {
            const next = new URLSearchParams(searchParams);
            next.set('page', String(nextPage));
            setSearchParams(next);
          }}
        />
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-4 text-sm text-text-secondary shadow-card">
        Related inventory:{' '}
        <Link to="/admin/negotiations" className="text-primary hover:underline">
          Negotiations
        </Link>{' '}
        ·{' '}
        <Link to="/admin/chat" className="text-primary hover:underline">
          Chat monitoring
        </Link>
      </section>

      <Drawer
        open={Boolean(selected)}
        title={selected?.kind === 'order' ? 'P2P order' : 'P2P request'}
        wide
        onClose={() => setSelected(null)}
      >
        {selected?.kind === 'request' ? (
          <div className="space-y-4">
            <StatusBadge status={selected.row.status} />
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Request id</dt>
                <dd className="mt-1 break-all font-mono text-xs">{selected.row.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">User</dt>
                <dd className="mt-1">
                  <Link
                    to={`/admin/users/${selected.row.userId}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {selected.row.userId}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Side / pair</dt>
                <dd className="mt-1">
                  {selected.row.side} {selected.row.baseCurrencyCode}/{selected.row.quoteCurrencyCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Amount / rate</dt>
                <dd className="mt-1 font-mono text-xs">
                  {formatDecimal(selected.row.amount)} @ {formatDecimal(selected.row.rate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Expires</dt>
                <dd className="mt-1">{formatDateTime(selected.row.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Notes</dt>
                <dd className="mt-1 text-text-secondary">{selected.row.notes || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Created</dt>
                <dd className="mt-1">{formatDateTime(selected.row.createdAt)}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {selected?.kind === 'order' ? (
          <div className="space-y-4">
            <StatusBadge status={selected.row.status} />
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Order id</dt>
                <dd className="mt-1 break-all font-mono text-xs">{selected.row.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Request id</dt>
                <dd className="mt-1 break-all font-mono text-xs">{selected.row.requestId}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Requester</dt>
                <dd className="mt-1">
                  <Link
                    to={`/admin/users/${selected.row.requesterId}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {selected.row.requesterId}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Acceptor</dt>
                <dd className="mt-1">
                  <Link
                    to={`/admin/users/${selected.row.acceptorId}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {selected.row.acceptorId}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Amount / rate</dt>
                <dd className="mt-1 font-mono text-xs">
                  {formatDecimal(selected.row.amount)} @ {formatDecimal(selected.row.rate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Created</dt>
                <dd className="mt-1">{formatDateTime(selected.row.createdAt)}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {selected ? (
          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-4">
              <Link
                to={`/admin/p2p/${selected.row.id}?kind=${selected.kind}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Open full detail page →
              </Link>
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Admin status override</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Status can be set to CANCELLED or COMPLETED only.
            </p>
            {!canWrite ? (
              <div className="mt-3">
                <ErrorState
                  title="Permission required"
                  description="p2p:write is required to update P2P status."
                />
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <Select
                  label="New status"
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as P2PAdminStatus)}
                >
                  {P2P_ADMIN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
                <Button onClick={() => setConfirmOpen(true)}>Review & update</Button>
              </div>
            )}
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm P2P status update"
        description={`Set ${selected?.kind ?? 'item'} ${selected?.row.id ?? ''} to ${statusDraft}? This change will be recorded in the audit log.`}
        confirmLabel="Update status"
        tone="danger"
        busy={statusMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => statusMutation.mutate()}
      />
    </div>
  );
}
