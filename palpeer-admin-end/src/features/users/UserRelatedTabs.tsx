import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockListCards } from '@/mocks/cards';
import { mockListKycCases } from '@/mocks/kyc';
import { mockListChatRooms, mockListNegotiations } from '@/mocks/negotiations';
import { mockListP2POrders, mockListP2PRequests } from '@/mocks/p2p';
import { mockListWallets } from '@/mocks/wallets';
import { listAdminCards } from '@/services/api/cards';
import { listAdminChatRooms } from '@/services/api/chat';
import { listKycCases } from '@/services/api/kyc';
import { listAdminNegotiations } from '@/services/api/negotiations';
import { listAdminP2POrders, listAdminP2PRequests } from '@/services/api/p2p';
import { listAdminWallets } from '@/services/api/wallets';
import type { KycCaseSummary, P2POrderSummary, P2PRequestSummary } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import type { CardSummary } from '@/types/cards';
import type { ChatRoomSummary, NegotiationSummary } from '@/types/negotiations';
import type { WalletSummary } from '@/types/wallets';

type TabId = 'wallets' | 'kyc' | 'cards' | 'p2p-requests' | 'p2p-orders' | 'negotiations' | 'chat';

const TABS: Array<{ id: TabId; label: string; permission: string }> = [
  { id: 'wallets', label: 'Wallets', permission: 'wallets:read' },
  { id: 'kyc', label: 'KYC', permission: 'kyc:read' },
  { id: 'cards', label: 'Cards', permission: 'cards:read' },
  { id: 'p2p-requests', label: 'P2P requests', permission: 'p2p:read' },
  { id: 'p2p-orders', label: 'P2P orders', permission: 'p2p:read' },
  { id: 'negotiations', label: 'Negotiations', permission: 'negotiations:read' },
  { id: 'chat', label: 'Chat rooms', permission: 'chat:read' },
];

const RELATED_PAGE_SIZE = 20;

async function mockDelay<T>(value: () => T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return value();
}

function errorText(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return error instanceof ApiClientError ? error.message : fallback;
}

function OpenLink({ to }: { to: string }) {
  return (
    <Link to={to} className="text-sm font-medium text-primary hover:underline">
      Open
    </Link>
  );
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function TotalHint({ total }: { total?: number }) {
  if (total == null || total <= RELATED_PAGE_SIZE) return null;
  return (
    <p className="mt-2 text-xs text-text-muted">
      Showing the latest {RELATED_PAGE_SIZE} of {total}. Open the module for the full list.
    </p>
  );
}

function WalletsTab({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ['admin-user-wallets', userId, appConfig.useMockApi],
    queryFn: () =>
      appConfig.useMockApi
        ? mockDelay(() => mockListWallets({ userId, size: RELATED_PAGE_SIZE }))
        : listAdminWallets({ userId, size: RELATED_PAGE_SIZE }),
  });
  const columns = useMemo<DataColumn<WalletSummary>[]>(
    () => [
      { id: 'currency', header: 'Currency', cell: (row) => <Badge tone="neutral">{row.currencyCode}</Badge> },
      {
        id: 'available',
        header: 'Available',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.availableBalance)}</span>,
      },
      {
        id: 'pending',
        header: 'Pending',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.pendingBalance)}</span>,
      },
      { id: 'id', header: 'Wallet', cell: (row) => <span className="font-mono text-[11px]">{row.id}</span> },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => <OpenLink to={`/admin/wallets/${row.id}`} />,
      },
    ],
    [],
  );
  return (
    <>
      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={errorText(query.error, 'Failed to load wallets.')}
        onRetry={() => void query.refetch()}
        emptyTitle="No wallets"
        emptyDescription="This user has no wallets."
      />
      <TotalHint total={query.data?.totalElements} />
    </>
  );
}

function KycTab({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ['admin-user-kyc', userId, appConfig.useMockApi],
    queryFn: () =>
      appConfig.useMockApi
        ? mockDelay(() => mockListKycCases({ userId, size: RELATED_PAGE_SIZE }))
        : listKycCases({ userId, size: RELATED_PAGE_SIZE }),
  });
  const columns = useMemo<DataColumn<KycCaseSummary>[]>(
    () => [
      { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
      {
        id: 'reason',
        header: 'Rejection reason',
        cell: (row) => <span className="text-sm text-text-secondary">{row.rejectionReason || '—'}</span>,
      },
      { id: 'createdAt', header: 'Created', cell: (row) => formatDateTime(row.createdAt) },
      { id: 'updatedAt', header: 'Updated', cell: (row) => formatDateTime(row.updatedAt) },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => <OpenLink to={`/admin/kyc/${row.caseId}`} />,
      },
    ],
    [],
  );
  return (
    <>
      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.caseId}
        loading={query.isLoading}
        error={errorText(query.error, 'Failed to load KYC cases.')}
        onRetry={() => void query.refetch()}
        emptyTitle="No KYC cases"
        emptyDescription="This user has not started KYC."
      />
      <TotalHint total={query.data?.totalElements} />
    </>
  );
}

function CardsTab({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ['admin-user-cards', userId, appConfig.useMockApi],
    queryFn: () =>
      appConfig.useMockApi
        ? mockDelay(() => mockListCards({ userId, size: RELATED_PAGE_SIZE }))
        : listAdminCards({ userId, size: RELATED_PAGE_SIZE }),
  });
  const columns = useMemo<DataColumn<CardSummary>[]>(
    () => [
      {
        id: 'card',
        header: 'Card',
        cell: (row) => (
          <span className="font-mono text-xs">
            {row.brand ?? 'CARD'} •••• {row.lastFour}
          </span>
        ),
      },
      { id: 'currency', header: 'Currency', cell: (row) => row.currencyCode },
      { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
      { id: 'createdAt', header: 'Created', cell: (row) => formatDateTime(row.createdAt) },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => <OpenLink to={`/admin/cards/${row.id}`} />,
      },
    ],
    [],
  );
  return (
    <>
      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={errorText(query.error, 'Failed to load cards.')}
        onRetry={() => void query.refetch()}
        emptyTitle="No cards"
        emptyDescription="This user has no issued cards."
      />
      <TotalHint total={query.data?.totalElements} />
    </>
  );
}

function P2PRequestsTab({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ['admin-user-p2p-requests', userId, appConfig.useMockApi],
    queryFn: () =>
      appConfig.useMockApi
        ? mockDelay(() => mockListP2PRequests({ userId }))
        : listAdminP2PRequests({ userId }),
  });
  const columns = useMemo<DataColumn<P2PRequestSummary>[]>(
    () => [
      { id: 'side', header: 'Side', cell: (row) => <Badge tone="neutral">{row.side}</Badge> },
      {
        id: 'pair',
        header: 'Pair',
        cell: (row) => `${row.baseCurrencyCode}/${row.quoteCurrencyCode}`,
      },
      {
        id: 'amount',
        header: 'Amount @ rate',
        cell: (row) => (
          <span className="font-mono text-xs">
            {formatDecimal(row.amount)} @ {formatDecimal(row.rate)}
          </span>
        ),
      },
      { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
      { id: 'createdAt', header: 'Created', cell: (row) => formatDateTime(row.createdAt) },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => <OpenLink to={`/admin/p2p/${row.id}?kind=request`} />,
      },
    ],
    [],
  );
  return (
    <DataTable
      columns={columns}
      rows={query.data ?? []}
      rowKey={(row) => row.id}
      loading={query.isLoading}
      error={errorText(query.error, 'Failed to load P2P requests.')}
      onRetry={() => void query.refetch()}
      emptyTitle="No P2P requests"
      emptyDescription="This user has not posted P2P requests."
    />
  );
}

function P2POrdersTab({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ['admin-user-p2p-orders', userId, appConfig.useMockApi],
    queryFn: () =>
      appConfig.useMockApi
        ? mockDelay(() => mockListP2POrders({ userId }))
        : listAdminP2POrders({ userId }),
  });
  const columns = useMemo<DataColumn<P2POrderSummary>[]>(
    () => [
      {
        id: 'role',
        header: 'Role',
        cell: (row) => (
          <Badge tone="neutral">{row.requesterId === userId ? 'Requester' : 'Acceptor'}</Badge>
        ),
      },
      {
        id: 'amount',
        header: 'Amount @ rate',
        cell: (row) => (
          <span className="font-mono text-xs">
            {formatDecimal(row.amount)} @ {formatDecimal(row.rate)}
          </span>
        ),
      },
      { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
      { id: 'createdAt', header: 'Created', cell: (row) => formatDateTime(row.createdAt) },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => <OpenLink to={`/admin/p2p/${row.id}?kind=order`} />,
      },
    ],
    [userId],
  );
  return (
    <DataTable
      columns={columns}
      rows={query.data ?? []}
      rowKey={(row) => row.id}
      loading={query.isLoading}
      error={errorText(query.error, 'Failed to load P2P orders.')}
      onRetry={() => void query.refetch()}
      emptyTitle="No P2P orders"
      emptyDescription="This user has no P2P orders as requester or acceptor."
    />
  );
}

function NegotiationsTab({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ['admin-user-negotiations', userId, appConfig.useMockApi],
    queryFn: () =>
      appConfig.useMockApi
        ? mockDelay(() => mockListNegotiations({ userId, size: RELATED_PAGE_SIZE }))
        : listAdminNegotiations({ userId, size: RELATED_PAGE_SIZE }),
  });
  const columns = useMemo<DataColumn<NegotiationSummary>[]>(
    () => [
      {
        id: 'role',
        header: 'Role',
        cell: (row) => (
          <Badge tone="neutral">{row.requesterId === userId ? 'Requester' : 'Counterparty'}</Badge>
        ),
      },
      {
        id: 'request',
        header: 'P2P request',
        cell: (row) => <span className="font-mono text-[11px]">{shortId(row.p2pRequestId)}</span>,
      },
      { id: 'offers', header: 'Offers', cell: (row) => row.offers?.length ?? 0 },
      { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
      { id: 'createdAt', header: 'Created', cell: (row) => formatDateTime(row.createdAt) },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => <OpenLink to={`/admin/negotiations/${row.id}`} />,
      },
    ],
    [userId],
  );
  return (
    <>
      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={errorText(query.error, 'Failed to load negotiations.')}
        onRetry={() => void query.refetch()}
        emptyTitle="No negotiations"
        emptyDescription="This user has no negotiations."
      />
      <TotalHint total={query.data?.totalElements} />
    </>
  );
}

function ChatTab({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ['admin-user-chat-rooms', userId, appConfig.useMockApi],
    queryFn: () =>
      appConfig.useMockApi
        ? mockDelay(() => mockListChatRooms({ userId, size: RELATED_PAGE_SIZE }))
        : listAdminChatRooms({ userId, size: RELATED_PAGE_SIZE }),
  });
  const columns = useMemo<DataColumn<ChatRoomSummary>[]>(
    () => [
      { id: 'id', header: 'Room', cell: (row) => <span className="font-mono text-[11px]">{row.id}</span> },
      {
        id: 'counterpart',
        header: 'Counterpart',
        cell: (row) => {
          const other = row.participantAId === userId ? row.participantBId : row.participantAId;
          return (
            <Link to={`/admin/users/${other}`} className="font-mono text-[11px] text-primary hover:underline">
              {shortId(other)}
            </Link>
          );
        },
      },
      {
        id: 'order',
        header: 'P2P order',
        cell: (row) =>
          row.p2pOrderId ? (
            <Link
              to={`/admin/p2p/${row.p2pOrderId}?kind=order`}
              className="font-mono text-[11px] text-primary hover:underline"
            >
              {shortId(row.p2pOrderId)}
            </Link>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      { id: 'createdAt', header: 'Created', cell: (row) => formatDateTime(row.createdAt) },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => <OpenLink to={`/admin/chat?room=${encodeURIComponent(row.id)}`} />,
      },
    ],
    [userId],
  );
  return (
    <>
      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={errorText(query.error, 'Failed to load chat rooms.')}
        onRetry={() => void query.refetch()}
        emptyTitle="No chat rooms"
        emptyDescription="This user is not a participant in any chat room."
      />
      <TotalHint total={query.data?.totalElements} />
    </>
  );
}

const TAB_CONTENT: Record<TabId, (props: { userId: string }) => ReactNode> = {
  wallets: WalletsTab,
  kyc: KycTab,
  cards: CardsTab,
  'p2p-requests': P2PRequestsTab,
  'p2p-orders': P2POrdersTab,
  negotiations: NegotiationsTab,
  chat: ChatTab,
};

export function UserRelatedTabs({ userId }: { userId: string }) {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleTabs = TABS.filter((tab) => can(tab.permission));
  const requested = searchParams.get('tab');
  const active = visibleTabs.find((tab) => tab.id === requested) ?? visibleTabs[0];

  function selectTab(id: TabId) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  }

  const Content = active ? TAB_CONTENT[active.id] : null;

  return (
    <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">Related activity</h3>
        {active ? <Badge tone="neutral">{active.permission}</Badge> : null}
      </div>
      {visibleTabs.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">
          Wallets, KYC, cards, P2P, negotiations, and chat each require their own read permission.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="User related activity">
            {visibleTabs.map((tab) => (
              <Button
                key={tab.id}
                role="tab"
                aria-selected={active?.id === tab.id}
                variant={active?.id === tab.id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => selectTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="mt-4" role="tabpanel">
            {Content ? <Content userId={userId} /> : null}
          </div>
        </>
      )}
    </section>
  );
}
