import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { EyeOff, MessageSquare } from 'lucide-react';
import {
  AUTO_REFRESH_INTERVAL_MS,
  AutoRefreshControl,
} from '@/components/data-display/AutoRefreshControl';
import { Drawer } from '@/components/dialogs/Drawer';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { mockListChatMessages, mockListChatRooms } from '@/mocks/negotiations';
import { listAdminChatMessages, listAdminChatRooms } from '@/services/api/chat';
import type { ChatRoomSummary } from '@/types/negotiations';
import { ApiClientError } from '@/types/api';

export function ChatPage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const allowed = can('chat:read');
  const selectedRoomId = searchParams.get('room');
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;
  const msgPage = Number(searchParams.get('msgPage') ?? '0') || 0;
  const refetchInterval = autoRefresh ? AUTO_REFRESH_INTERVAL_MS : false;

  const setSelectedRoomId = useCallback(
    (roomId: string | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (roomId) next.set('room', roomId);
        else next.delete('room');
        next.delete('msgPage');
        return next;
      });
    },
    [setSearchParams],
  );

  const roomsQuery = useQuery({
    queryKey: ['admin-chat-rooms', page, size, appConfig.useMockApi],
    enabled: allowed,
    refetchInterval,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return mockListChatRooms({ page, size });
      }
      return listAdminChatRooms({ page, size });
    },
  });

  const messagesQuery = useQuery({
    queryKey: ['admin-chat-messages', selectedRoomId, msgPage, appConfig.useMockApi],
    enabled: Boolean(selectedRoomId) && allowed,
    refetchInterval,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockListChatMessages(selectedRoomId!, { page: msgPage, size: 20 });
      }
      return listAdminChatMessages(selectedRoomId!, { page: msgPage, size: 20 });
    },
  });

  const columns = useMemo<DataColumn<ChatRoomSummary>[]>(
    () => [
      {
        id: 'id',
        header: 'Room',
        cell: (row) => <span className="font-mono text-[11px]">{row.id}</span>,
      },
      {
        id: 'scope',
        header: 'Linked to',
        cell: (row) =>
          row.negotiationId ? (
            <Link
              to={`/admin/negotiations/${row.negotiationId}`}
              className="font-mono text-xs text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              Negotiation {row.negotiationId}
            </Link>
          ) : row.p2pOrderId ? (
            <Link
              to={`/admin/p2p/${row.p2pOrderId}?kind=order`}
              className="font-mono text-xs text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              Order {row.p2pOrderId}
            </Link>
          ) : (
            <span className="text-xs text-text-muted">—</span>
          ),
      },
      {
        id: 'participants',
        header: 'Participants',
        cell: (row) => (
          <span className="font-mono text-[11px] text-text-secondary">
            {row.participantAId} · {row.participantBId}
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
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedRoomId(row.id);
            }}
          >
            Inspect
          </Button>
        ),
      },
    ],
    [setSelectedRoomId],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="chat:read is required to view chat monitoring."
      />
    );
  }

  const errorMessage =
    roomsQuery.error instanceof ApiClientError
      ? roomsQuery.error.message
      : roomsQuery.error
        ? 'Failed to load chat rooms.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Chat monitoring</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Chat rooms and message history between users. Turn on auto-refresh to reload rooms
              and the open room&apos;s messages every 15 seconds.
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
            updatedAt={roomsQuery.dataUpdatedAt}
            fetching={roomsQuery.isFetching}
            onRefresh={() => void roomsQuery.refetch()}
          />
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-dashed border-warning/40 bg-warning/5 p-5">
        <div className="flex items-center gap-2 text-warning">
          <EyeOff className="h-4 w-4" aria-hidden />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Message privacy</h3>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Messages are private. Only open conversations when needed for support or an
          investigation. Sample data is labelled as non-production.
        </p>
      </section>

      <DataTable
        columns={columns}
        rows={roomsQuery.data?.content ?? []}
        rowKey={(row) => row.id}
        loading={roomsQuery.isLoading}
        error={errorMessage}
        onRetry={() => void roomsQuery.refetch()}
        emptyTitle="No chat rooms"
        emptyDescription="No chat rooms were returned for this page."
        onRowClick={(row) => setSelectedRoomId(row.id)}
      />

      {roomsQuery.data ? (
        <Pagination
          page={roomsQuery.data.number}
          totalPages={roomsQuery.data.totalPages}
          totalElements={roomsQuery.data.totalElements}
          onPageChange={(nextPage) => {
            const next = new URLSearchParams(searchParams);
            next.set('page', String(nextPage));
            setSearchParams(next);
          }}
        />
      ) : null}

      <Drawer
        open={Boolean(selectedRoomId)}
        title="Chat room"
        wide
        onClose={() => setSelectedRoomId(null)}
      >
        {selectedRoomId ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-text-secondary">{selectedRoomId}</span>
            <span className="text-xs text-text-muted">
              Last updated:{' '}
              {messagesQuery.dataUpdatedAt
                ? formatDateTime(new Date(messagesQuery.dataUpdatedAt).toISOString())
                : '—'}
            </span>
          </div>
        ) : null}
        {messagesQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : messagesQuery.isError ? (
          <ErrorState
            description={
              messagesQuery.error instanceof ApiClientError
                ? messagesQuery.error.message
                : 'Failed to load messages.'
            }
            onRetry={() => void messagesQuery.refetch()}
          />
        ) : (messagesQuery.data?.content.length ?? 0) === 0 ? (
          <EmptyState title="No messages" description="This room has no messages on this page." />
        ) : (
          <div className="space-y-4">
            <ul className="space-y-3">
              {messagesQuery.data!.content.map((message) => (
                <li
                  key={message.id}
                  className="rounded-[0.6rem] border border-border bg-surface-secondary/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
                    <span className="font-mono">{message.senderId}</span>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-text-primary">{message.content}</p>
                  {appConfig.useMockApi ? (
                    <Badge tone="warning" className="mt-2">
                      Mock content
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pagination
              page={messagesQuery.data!.number}
              totalPages={messagesQuery.data!.totalPages}
              totalElements={messagesQuery.data!.totalElements}
              onPageChange={(nextPage) => {
                const next = new URLSearchParams(searchParams);
                next.set('msgPage', String(nextPage));
                setSearchParams(next);
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
