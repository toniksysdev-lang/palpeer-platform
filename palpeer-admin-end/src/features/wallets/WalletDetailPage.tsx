import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import {
  mockActOnMovement,
  mockCreateFunding,
  mockCreateWithdrawal,
  mockGetWallet,
  mockWalletMovements,
  mockWalletTransactions,
} from '@/mocks/wallets';
import {
  actOnAdminWalletFunding,
  actOnAdminWalletWithdrawal,
  createAdminWalletFunding,
  createAdminWalletWithdrawal,
  getAdminWallet,
  listAdminWalletMovements,
  listAdminWalletTransactions,
  type MoneyMovementAction,
} from '@/services/api/wallets';
import type { AdminMoneyMovement, LedgerTransactionSummary, MoneyMovementStatus } from '@/types/wallets';
import { ApiClientError } from '@/types/api';

type PendingAction = {
  movement: AdminMoneyMovement;
  action: MoneyMovementAction;
};

function statusTone(status: MoneyMovementStatus): 'success' | 'warning' | 'danger' | 'primary' | 'neutral' {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'REVERSED') return 'neutral';
  if (status === 'PROCESSING') return 'primary';
  return 'warning';
}

function canProcess(status: MoneyMovementStatus, type: AdminMoneyMovement['type']): boolean {
  if (type === 'FUNDING') return status === 'INITIATED' || status === 'PENDING';
  return status === 'INITIATED' || status === 'PENDING' || status === 'PROCESSING';
}

function canFail(status: MoneyMovementStatus): boolean {
  return status === 'INITIATED' || status === 'PENDING' || status === 'PROCESSING';
}

function canReverse(status: MoneyMovementStatus): boolean {
  return status === 'SUCCESS';
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function WalletDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('wallets:read');
  const canOperate = can('payments:operate');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const [fundAmount, setFundAmount] = useState('');
  const [fundRef, setFundRef] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawRef, setWithdrawRef] = useState('');
  const [failReason, setFailReason] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [confirmCreate, setConfirmCreate] = useState<'funding' | 'withdrawal' | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const needsMfa =
    pendingAction?.action === 'process' || pendingAction?.action === 'reverse';
  const mfaReady = /^\d{6}$/.test(mfaCode.trim());

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

  const movementsQuery = useQuery({
    queryKey: ['admin-wallet-movements', id, appConfig.useMockApi],
    enabled: Boolean(id) && allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockWalletMovements(id);
      }
      return listAdminWalletMovements(id);
    },
  });

  async function invalidateWalletData() {
    await queryClient.invalidateQueries({ queryKey: ['admin-wallet', id] });
    await queryClient.invalidateQueries({ queryKey: ['admin-wallet-tx', id] });
    await queryClient.invalidateQueries({ queryKey: ['admin-wallet-movements', id] });
  }

  const createMutation = useMutation({
    mutationFn: async (kind: 'funding' | 'withdrawal') => {
      const key = newIdempotencyKey();
      if (kind === 'funding') {
        if (!(Number(fundAmount) > 0)) {
          throw new ApiClientError(400, 'VALIDATION_FAILED', 'Enter a funding amount greater than zero.');
        }
        if (appConfig.useMockApi) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return mockCreateFunding(id, fundAmount, fundRef.trim() || undefined);
        }
        return createAdminWalletFunding(
          id,
          { amount: fundAmount, providerReference: fundRef.trim() || undefined },
          key,
        );
      }
      if (!(Number(withdrawAmount) > 0)) {
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Enter a withdrawal amount greater than zero.');
      }
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockCreateWithdrawal(id, withdrawAmount, withdrawRef.trim() || undefined);
      }
      return createAdminWalletWithdrawal(
        id,
        { amount: withdrawAmount, destinationReference: withdrawRef.trim() || undefined },
        key,
      );
    },
    onSuccess: async (created, kind) => {
      setConfirmCreate(null);
      if (kind === 'funding') {
        setFundAmount('');
        setFundRef('');
      } else {
        setWithdrawAmount('');
        setWithdrawRef('');
      }
      push({
        tone: 'success',
        title: kind === 'funding' ? 'Funding initiated' : 'Withdrawal initiated',
        description: `${formatDecimal(created.amount)} ${created.currencyCode} · ${created.status}`,
      });
      await invalidateWalletData();
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Action failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (input: PendingAction) => {
      const { movement, action } = input;
      if (appConfig.useMockApi) {
        if ((action === 'process' || action === 'reverse') && !/^\d{6}$/.test(mfaCode.trim())) {
          throw new ApiClientError(401, 'MFA_INVALID', 'Enter the 6-digit authenticator code.');
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockActOnMovement(id, movement.id, action, failReason.trim() || undefined);
      }
      const options = {
        reason: failReason.trim() || undefined,
        mfaCode: mfaCode.trim() || undefined,
      };
      if (movement.type === 'FUNDING') {
        await actOnAdminWalletFunding(id, movement.id, action, options);
      } else {
        await actOnAdminWalletWithdrawal(id, movement.id, action, options);
      }
      return movement;
    },
    onSuccess: async (_data, variables) => {
      setPendingAction(null);
      setFailReason('');
      setMfaCode('');
      const done =
        variables.action === 'process'
          ? 'processed'
          : variables.action === 'fail'
            ? 'failed'
            : 'reversed';
      push({
        tone: 'success',
        title: `${variables.movement.type === 'FUNDING' ? 'Funding' : 'Withdrawal'} ${done}`,
      });
      await invalidateWalletData();
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Action failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
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

  const movementColumns = useMemo<DataColumn<AdminMoneyMovement>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'When',
        cell: (row) => formatDateTime(row.createdAt),
      },
      {
        id: 'type',
        header: 'Type',
        cell: (row) => <Badge tone={row.type === 'FUNDING' ? 'success' : 'warning'}>{row.type}</Badge>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
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
        id: 'reference',
        header: 'Reference',
        cell: (row) => (
          <span className="text-xs text-text-secondary">
            {row.providerName ? `${row.providerName} · ` : ''}
            {row.reference || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (row) =>
          canOperate ? (
            <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
              {canProcess(row.status, row.type) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setMfaCode('');
                    setFailReason('');
                    setPendingAction({ movement: row, action: 'process' });
                  }}
                >
                  Process
                </Button>
              ) : null}
              {canFail(row.status) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setMfaCode('');
                    setFailReason('');
                    setPendingAction({ movement: row, action: 'fail' });
                  }}
                >
                  Fail
                </Button>
              ) : null}
              {canReverse(row.status) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setMfaCode('');
                    setFailReason('');
                    setPendingAction({ movement: row, action: 'reverse' });
                  }}
                >
                  Reverse
                </Button>
              ) : null}
            </div>
          ) : null,
      },
    ],
    [actionMutation.isPending, canOperate],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="wallets:read is required to view wallet detail."
      />
    );
  }

  const currency = walletQuery.data?.currencyCode ?? '';

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
        <h3 className="text-base font-semibold text-text-primary">Funding / withdrawal admin actions</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Initiate funding or withdrawal for this wallet, then process, fail, or reverse movements.
          Requires <span className="font-mono text-xs">payments:operate</span>.
        </p>

        {!canOperate ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="payments:operate is required to create or operate on funding and withdrawals."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[0.5rem] border border-border p-4">
              <h4 className="text-sm font-semibold text-text-primary">Create funding</h4>
              <p className="mt-1 text-xs text-text-secondary">
                Starts as INITIATED (or PENDING if a rail is enabled). Process to credit the ledger.
              </p>
              <div className="mt-3 grid gap-3">
                <Input
                  label={`Amount (${currency || '…'})`}
                  value={fundAmount}
                  onChange={(event) => setFundAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <Input
                  label="Provider reference (optional)"
                  value={fundRef}
                  onChange={(event) => setFundRef(event.target.value)}
                  placeholder="External ref"
                />
                <Button onClick={() => setConfirmCreate('funding')}>Review & fund</Button>
              </div>
            </div>
            <div className="rounded-[0.5rem] border border-border p-4">
              <h4 className="text-sm font-semibold text-text-primary">Create withdrawal</h4>
              <p className="mt-1 text-xs text-text-secondary">
                Places a HOLD on available balance immediately. Process settles RELEASE + DEBIT.
              </p>
              <div className="mt-3 grid gap-3">
                <Input
                  label={`Amount (${currency || '…'})`}
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <Input
                  label="Destination reference (optional)"
                  value={withdrawRef}
                  onChange={(event) => setWithdrawRef(event.target.value)}
                  placeholder="Bank / payout ref"
                />
                <Button variant="secondary" onClick={() => setConfirmCreate('withdrawal')}>
                  Review & withdraw
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold text-text-primary">Recent movements</h4>
          <DataTable
            columns={movementColumns}
            rows={movementsQuery.data ?? []}
            rowKey={(row) => `${row.type}:${row.id}`}
            loading={movementsQuery.isLoading}
            error={
              movementsQuery.error instanceof ApiClientError
                ? movementsQuery.error.message
                : movementsQuery.error
                  ? 'Failed to load movements.'
                  : null
            }
            onRetry={() => void movementsQuery.refetch()}
            emptyTitle="No funding or withdrawals"
            emptyDescription="Create a funding or withdrawal above to see it here."
          />
        </div>
      </section>

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

      <ConfirmDialog
        open={Boolean(confirmCreate)}
        title={confirmCreate === 'funding' ? 'Initiate funding?' : 'Initiate withdrawal?'}
        description={
          confirmCreate === 'funding'
            ? `Credit path for ${fundAmount || '—'} ${currency} on this wallet. Status will start as INITIATED until processed.`
            : `Hold ${withdrawAmount || '—'} ${currency} on this wallet. Available balance decreases until the withdrawal is processed or failed.`
        }
        confirmLabel={confirmCreate === 'funding' ? 'Initiate funding' : 'Initiate withdrawal'}
        tone="primary"
        busy={createMutation.isPending}
        onClose={() => setConfirmCreate(null)}
        onConfirm={() => confirmCreate && createMutation.mutate(confirmCreate)}
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction
            ? `${pendingAction.action[0].toUpperCase()}${pendingAction.action.slice(1)} ${pendingAction.movement.type.toLowerCase()}?`
            : ''
        }
        description={
          pendingAction
            ? `${pendingAction.action} ${formatDecimal(pendingAction.movement.amount)} ${pendingAction.movement.currencyCode} (${pendingAction.movement.status} → ${pendingAction.action === 'process' ? 'SUCCESS' : pendingAction.action === 'fail' ? 'FAILED' : 'REVERSED'}).${
                needsMfa ? ' Confirm with your Google Authenticator code.' : ''
              }`
            : ''
        }
        confirmLabel={pendingAction ? `${pendingAction.action[0].toUpperCase()}${pendingAction.action.slice(1)}` : 'Confirm'}
        tone={pendingAction?.action === 'fail' || pendingAction?.action === 'reverse' ? 'danger' : 'primary'}
        busy={actionMutation.isPending}
        confirmDisabled={needsMfa && !mfaReady}
        onClose={() => {
          setPendingAction(null);
          setFailReason('');
          setMfaCode('');
        }}
        onConfirm={() => pendingAction && actionMutation.mutate(pendingAction)}
      >
        {pendingAction?.action === 'fail' ? (
          <div className="mt-3">
            <Input
              label="Failure reason (optional)"
              value={failReason}
              onChange={(event) => setFailReason(event.target.value)}
              placeholder="e.g. Provider rejected"
            />
          </div>
        ) : null}
        {needsMfa ? (
          <div className="mt-3">
            <Input
              label="Google Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
