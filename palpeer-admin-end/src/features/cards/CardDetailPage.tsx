import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ContractPendingState } from '@/components/feedback/ContractPendingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import {
  formatMaskedPan,
  mockBlockCard,
  mockCardTransactions,
  mockGetCard,
  mockUnblockCard,
} from '@/mocks/cards';
import {
  adminBlockCard,
  adminUnblockCard,
  getAdminCard,
  listAdminCardTransactions,
} from '@/services/api/cards';
import type { CardTransactionSummary } from '@/types/cards';
import { ApiClientError } from '@/types/api';

type CardAction = 'block' | 'unblock';

export function CardDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmAction, setConfirmAction] = useState<CardAction | null>(null);

  const canRead = can('cards:read');
  const canWrite = can('cards:write');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const cardQuery = useQuery({
    queryKey: ['admin-card', id, appConfig.useMockApi],
    enabled: Boolean(id) && canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockGetCard(id);
      }
      return getAdminCard(id);
    },
  });

  const txQuery = useQuery({
    queryKey: ['admin-card-tx', id, page, size, appConfig.useMockApi],
    enabled: Boolean(id) && canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockCardTransactions(id, { page, size });
      }
      return listAdminCardTransactions(id, { page, size });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (action: CardAction) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return action === 'block' ? mockBlockCard(id) : mockUnblockCard(id);
      }
      return action === 'block' ? adminBlockCard(id) : adminUnblockCard(id);
    },
    onSuccess: async (card, action) => {
      setConfirmAction(null);
      push({
        tone: 'success',
        title: action === 'block' ? 'Card blocked' : 'Card unblocked',
        description: `Status is now ${card.status}.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-card', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-cards'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Card action failed',
        description: error instanceof ApiClientError ? error.message : 'Update failed.',
      });
    },
  });

  const txColumns = useMemo<DataColumn<CardTransactionSummary>[]>(
    () => [
      {
        id: 'occurredAt',
        header: 'When',
        cell: (row) => formatDateTime(row.occurredAt ?? row.createdAt),
      },
      {
        id: 'entryType',
        header: 'Type',
        cell: (row) => <Badge tone="neutral">{row.entryType}</Badge>,
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
            {formatDecimal(row.amount)} {row.currencyCode}
          </span>
        ),
      },
      {
        id: 'merchant',
        header: 'Merchant',
        cell: (row) => row.merchantName || '—',
      },
    ],
    [],
  );

  if (!canRead) {
    return (
      <ErrorState
        title="Permission required"
        description="cards:read is required to view card detail."
      />
    );
  }

  const status = cardQuery.data?.status?.toUpperCase() ?? '';
  const canBlock = canWrite && status !== 'BLOCKED';
  const canUnblock = canWrite && status === 'BLOCKED';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/cards')}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back
        </Button>
        <Link to="/admin/cards" className="text-sm text-primary hover:underline">
          All cards
        </Link>
      </div>

      {cardQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {cardQuery.isError ? (
        <ErrorState
          description={
            cardQuery.error instanceof ApiClientError
              ? cardQuery.error.message
              : 'Failed to load card.'
          }
          onRetry={() => void cardQuery.refetch()}
        />
      ) : null}

      {cardQuery.data ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Card</p>
              <h1 className="mt-1 font-mono text-2xl font-semibold tracking-wide text-text-primary">
                {formatMaskedPan(cardQuery.data.lastFour)}
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                {cardQuery.data.brand || 'CARD'} · {cardQuery.data.currencyCode}
              </p>
            </div>
            <StatusBadge status={cardQuery.data.status} />
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-text-muted">Cardholder</dt>
              <dd className="mt-1 text-sm">{cardQuery.data.cardholderName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Wallet</dt>
              <dd className="mt-1">
                <Link
                  to={`/admin/wallets/${cardQuery.data.walletId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {cardQuery.data.walletId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Expiry</dt>
              <dd className="mt-1 font-mono text-sm">
                {cardQuery.data.expiryMonth && cardQuery.data.expiryYear
                  ? `${String(cardQuery.data.expiryMonth).padStart(2, '0')}/${cardQuery.data.expiryYear}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Provider</dt>
              <dd className="mt-1 text-sm">{cardQuery.data.providerName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Provider card id</dt>
              <dd className="mt-1 font-mono text-xs">{cardQuery.data.providerCardId || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Created</dt>
              <dd className="mt-1 text-sm">{formatDateTime(cardQuery.data.createdAt)}</dd>
            </div>
          </dl>

          <p className="mt-4 text-xs text-text-muted">
            The full card number and CVV are never shown.
          </p>

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text-primary">Lifecycle</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Block or unblock this card.
            </p>
            {!canWrite ? (
              <div className="mt-3">
                <ErrorState
                  title="Permission required"
                  description="cards:write is required to block or unblock cards."
                />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  disabled={!canBlock || actionMutation.isPending}
                  onClick={() => setConfirmAction('block')}
                >
                  Block card
                </Button>
                <Button
                  variant="secondary"
                  disabled={!canUnblock || actionMutation.isPending}
                  onClick={() => setConfirmAction('unblock')}
                >
                  Unblock card
                </Button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Card transactions</h3>
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
                  ? 'Failed to load card transactions.'
                  : null
            }
            onRetry={() => void txQuery.refetch()}
            emptyTitle="No card transactions"
            emptyDescription="No transactions were returned for this card."
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

      <ContractPendingState
        title="Funding / withdrawal from card"
        description="Funding or withdrawing from a card is not available to admins yet."
      />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction === 'block' ? 'Block this card?' : 'Unblock this card?'}
        description={
          confirmAction === 'block'
            ? `Block card ${id}? The change will be recorded in the audit log.`
            : `Unblock card ${id}? The change will be recorded in the audit log.`
        }
        confirmLabel={confirmAction === 'block' ? 'Block card' : 'Unblock card'}
        tone={confirmAction === 'block' ? 'danger' : 'primary'}
        busy={actionMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) actionMutation.mutate(confirmAction);
        }}
      />
    </div>
  );
}
