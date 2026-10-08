import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { transactionDetailPath } from '@/features/transactions/transactionPaths';
import { UserNotesPanel } from '@/features/users/UserNotesPanel';
import { UserRelatedTabs } from '@/features/users/UserRelatedTabs';
import { formatDateTime, formatDecimal } from '@/lib/format';
import {
  mockDeleteUser,
  mockGetUser,
  mockUpdateUser,
  mockUserRecentTransactions,
  mockUserTransactionHistory,
} from '@/mocks/users';
import {
  deleteAdminUser,
  getAdminUser,
  getAdminUserRecentTransactions,
  getAdminUserTransactionHistory,
  updateAdminUser,
} from '@/services/api/users';
import { ApiClientError } from '@/types/api';
import type { TransactionItem } from '@/types/users';
import { USER_STATUSES, type UserStatus } from '@/types/users';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const canRead = can('users:read');
  const canWrite = can('users:write');
  const canTx = can('transactions:read');

  const [statusDraft, setStatusDraft] = useState<UserStatus | ''>('');
  const [enabledDraft, setEnabledDraft] = useState<'true' | 'false' | ''>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const userQuery = useQuery({
    queryKey: ['admin-user', id, appConfig.useMockApi],
    enabled: Boolean(id) && canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 200));
        return mockGetUser(id);
      }
      return getAdminUser(id);
    },
  });

  const recentQuery = useQuery({
    queryKey: ['admin-user-tx-recent', id, appConfig.useMockApi],
    enabled: Boolean(id) && canTx,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 200));
        return mockUserRecentTransactions(id);
      }
      return getAdminUserRecentTransactions(id, 10);
    },
  });

  const historyQuery = useQuery({
    queryKey: ['admin-user-tx-history', id, appConfig.useMockApi],
    enabled: Boolean(id) && canTx,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 200));
        return mockUserTransactionHistory(id);
      }
      return getAdminUserTransactionHistory(id, { page: 0, size: 20 });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        status: statusDraft || undefined,
        enabled: enabledDraft === '' ? undefined : enabledDraft === 'true',
      };
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 250));
        return mockUpdateUser(id, payload);
      }
      return updateAdminUser(id, payload);
    },
    onSuccess: async () => {
      setConfirmOpen(false);
      push({ tone: 'success', title: 'User updated', description: 'The change has been saved.' });
      await queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'users'] });
      setStatusDraft('');
      setEnabledDraft('');
    },
    onError: (error) => {
      const message = error instanceof ApiClientError ? error.message : 'User update failed.';
      push({ tone: 'error', title: 'Update failed', description: message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 250));
        mockDeleteUser(id);
        return;
      }
      await deleteAdminUser(id);
    },
    onSuccess: async () => {
      setDeleteConfirmOpen(false);
      push({
        tone: 'success',
        title: 'User deleted',
        description: 'The app user and all related records were removed.',
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'users'] });
      navigate('/admin/users');
    },
    onError: (error) => {
      const message = error instanceof ApiClientError ? error.message : 'User delete failed.';
      push({ tone: 'error', title: 'Delete failed', description: message });
    },
  });

  const txColumns = useMemo<DataColumn<TransactionItem>[]>(
    () => [
      {
        id: 'type',
        header: 'Type',
        cell: (row) => <Badge tone="neutral">{row.type}</Badge>,
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
            to={transactionDetailPath(row, id)}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open
          </Link>
        ),
      },
    ],
    [id],
  );

  if (!canRead) {
    return (
      <ErrorState
        title="Permission required"
        description="users:read is required to view user details."
      />
    );
  }

  if (userQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    const message =
      userQuery.error instanceof ApiClientError
        ? userQuery.error.message
        : 'Failed to load user.';
    return <ErrorState description={message} onRetry={() => void userQuery.refetch()} />;
  }

  const user = userQuery.data;
  const pendingStatus = statusDraft || user.status;
  const pendingEnabled =
    enabledDraft === '' ? user.enabled : enabledDraft === 'true';
  const hasChanges =
    (statusDraft !== '' && statusDraft !== user.status) ||
    (enabledDraft !== '' && (enabledDraft === 'true') !== user.enabled);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back
        </Button>
        <Link to="/admin/users" className="text-sm text-primary hover:underline">
          All users
        </Link>
      </div>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">User</p>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary">{user.email}</h1>
            <p className="mt-1 font-mono text-xs text-text-muted">{user.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={user.status} />
            <Badge tone={user.enabled ? 'success' : 'danger'}>
              {user.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-text-muted">Phone</dt>
            <dd className="mt-1 text-sm text-text-primary">{user.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Email verified</dt>
            <dd className="mt-1 text-sm text-text-primary">{user.emailVerified ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Phone verified</dt>
            <dd className="mt-1 text-sm text-text-primary">{user.phoneVerified ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Registered</dt>
            <dd className="mt-1 text-sm text-text-primary">{formatDateTime(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Admin controls</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Change this user&apos;s account status or enable and disable their access.
        </p>

        {!canWrite ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="users:write is required to change user status or enabled state."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Select
              label="Status"
              value={statusDraft || user.status}
              onChange={(event) => setStatusDraft(event.target.value as UserStatus)}
            >
              {USER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Select
              label="Enabled"
              value={enabledDraft || String(user.enabled)}
              onChange={(event) => setEnabledDraft(event.target.value as 'true' | 'false')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
            <div className="md:col-span-2">
              <Button disabled={!hasChanges || updateMutation.isPending} onClick={() => setConfirmOpen(true)}>
                Review & save changes
              </Button>
            </div>
          </div>
        )}
      </section>

      {canWrite ? (
        <section className="rounded-[0.6rem] border border-danger/30 bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Delete user</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Permanently remove this app user and every related record (wallets, transactions, KYC,
            P2P, chat, cards, notes, and auth data). This cannot be undone.
          </p>
          <div className="mt-4">
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text-primary">Recent transactions</h3>
          <Link
            to={`/admin/transactions?userId=${encodeURIComponent(id)}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open module
          </Link>
        </div>
        {!canTx ? (
          <ErrorState
            title="Permission required"
            description="transactions:read is required to view this user’s transactions."
          />
        ) : (
          <DataTable
            columns={txColumns}
            rows={recentQuery.data ?? []}
            rowKey={(row) => `${row.type}-${row.id}`}
            loading={recentQuery.isLoading}
            error={
              recentQuery.error instanceof ApiClientError
                ? recentQuery.error.message
                : recentQuery.error
                  ? 'Failed to load recent transactions.'
                  : null
            }
            onRetry={() => void recentQuery.refetch()}
            emptyTitle="No recent transactions"
            emptyDescription="This user has no recent funding, withdrawal, or exchange activity."
          />
        )}
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Transaction history</h3>
        {!canTx ? (
          <ErrorState
            title="Permission required"
            description="transactions:read is required to view transaction history."
          />
        ) : historyQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : historyQuery.isError ? (
          <ErrorState
            description={
              historyQuery.error instanceof ApiClientError
                ? historyQuery.error.message
                : 'Failed to load history.'
            }
            onRetry={() => void historyQuery.refetch()}
          />
        ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No transaction history"
            description="History is empty for the default page window."
          />
        ) : (
          <DataTable
            columns={txColumns}
            rows={historyQuery.data?.items ?? []}
            rowKey={(row) => `history-${row.type}-${row.id}`}
          />
        )}
        {historyQuery.data ? (
          <p className="mt-3 text-xs text-text-muted">
            Showing page {historyQuery.data.page + 1} · {historyQuery.data.totalElements} total
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Audit trail</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Open the audit log filtered to this user.
          </p>
          {can('audit:read') ? (
            <Link
              to={`/admin/audit?userRef=${encodeURIComponent(user.id)}`}
              className="mt-3 inline-flex text-sm text-primary hover:underline"
            >
              View audit logs →
            </Link>
          ) : (
            <p className="mt-3 text-xs text-text-muted">You don&apos;t have access to audit logs.</p>
          )}
        </section>
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">KYC shortcuts</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Open the KYC queue filtered to this user.
          </p>
          {can('kyc:read') ? (
            <Link
              to={`/admin/kyc?userId=${encodeURIComponent(user.id)}`}
              className="mt-3 inline-flex text-sm text-primary hover:underline"
            >
              View KYC cases →
            </Link>
          ) : (
            <p className="mt-3 text-xs text-text-muted">You don&apos;t have access to KYC cases.</p>
          )}
        </section>
      </div>

      <UserNotesPanel userId={user.id} />

      <UserRelatedTabs userId={user.id} />

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm user update"
        description={`Set ${user.email} to status ${pendingStatus} and ${pendingEnabled ? 'enabled' : 'disabled'}? Suspending or closing a user may disable their login.`}
        confirmLabel="Save changes"
        tone="danger"
        busy={updateMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => updateMutation.mutate()}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete app user"
        description={`Permanently delete ${user.email} and all related records? Wallets, transactions, KYC files, P2P activity, chat, cards, and auth data will be removed. This cannot be undone.`}
        confirmLabel="Delete forever"
        tone="danger"
        busy={deleteMutation.isPending}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
