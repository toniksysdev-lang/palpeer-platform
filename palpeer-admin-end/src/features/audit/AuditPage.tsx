import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { Drawer } from '@/components/dialogs/Drawer';
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
import { mockSearchAuditLogs } from '@/mocks/audit';
import { searchAuditLogs } from '@/services/api/audit';
import type { AuditLogEntry } from '@/types/admin';
import { ApiClientError } from '@/types/api';

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

function truncate(value: string | null | undefined, max = 48): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function AuditPage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('audit:read');

  const userRef = searchParams.get('userRef') ?? '';
  const action = searchParams.get('action') ?? '';
  const entity = searchParams.get('entity') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '50') || 50;
  const sort = searchParams.get('sort') ?? 'createdAt,desc';

  const [userRefDraft, setUserRefDraft] = useState(userRef);
  const [actionDraft, setActionDraft] = useState(action);
  const [entityDraft, setEntityDraft] = useState(entity);
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    setUserRefDraft(userRef);
    setActionDraft(action);
    setEntityDraft(entity);
    setFromDraft(from);
    setToDraft(to);
  }, [userRef, action, entity, from, to]);

  const query = useQuery({
    queryKey: [
      'admin-audit-logs',
      userRef,
      action,
      entity,
      from,
      to,
      page,
      size,
      sort,
      appConfig.useMockApi,
    ],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockSearchAuditLogs({
          userRef: userRef || undefined,
          action: action || undefined,
          entity: entity || undefined,
          page,
          size,
        });
      }
      return searchAuditLogs({
        userRef: userRef || undefined,
        action: action || undefined,
        entity: entity || undefined,
        from: localInputToIso(from),
        to: localInputToIso(to, true),
        page,
        size,
        sort,
      });
    },
  });

  const columns = useMemo<DataColumn<AuditLogEntry>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'Timestamp',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>
        ),
      },
      {
        id: 'userRef',
        header: 'Actor',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-xs text-text-primary">{row.actorEmail || '—'}</p>
            {row.userRef && row.actorEmail !== row.userRef ? (
              <p className="truncate font-mono text-[10px] text-text-muted">{row.userRef}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        cell: (row) => <Badge tone="neutral">{row.action}</Badge>,
      },
      {
        id: 'entity',
        header: 'Entity',
        cell: (row) => row.entity || '—',
      },
      {
        id: 'newValue',
        header: 'After',
        cell: (row) => (
          <span className="font-mono text-[11px] text-text-secondary">
            {truncate(row.newValue)}
          </span>
        ),
      },
      {
        id: 'ip',
        header: 'IP',
        cell: (row) => (
          <span className="font-mono text-[11px] text-text-muted">{row.ipAddress || '—'}</span>
        ),
      },
    ],
    [],
  );

  function applyFilters() {
    const next = new URLSearchParams();
    if (userRefDraft.trim()) next.set('userRef', userRefDraft.trim());
    if (actionDraft.trim()) next.set('action', actionDraft.trim());
    if (entityDraft.trim()) next.set('entity', entityDraft.trim());
    if (fromDraft) next.set('from', fromDraft);
    if (toDraft) next.set('to', toDraft);
    next.set('page', '0');
    next.set('size', String(size));
    next.set('sort', sort);
    setSearchParams(next);
  }

  function clearFilters() {
    setUserRefDraft('');
    setActionDraft('');
    setEntityDraft('');
    setFromDraft('');
    setToDraft('');
    const next = new URLSearchParams();
    next.set('page', '0');
    next.set('size', String(size));
    next.set('sort', sort);
    setSearchParams(next);
  }

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="audit:read is required to view audit logs."
      />
    );
  }

  const rows = query.data?.content ?? [];
  const errorMessage =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.error
        ? 'Failed to load audit logs.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Audit Logs</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Search the record of administrative actions by actor, action, entity, and date.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            label="Actor"
            value={userRefDraft}
            onChange={(event) => setUserRefDraft(event.target.value)}
            placeholder="email or user reference"
          />
          <Input
            label="Action"
            value={actionDraft}
            onChange={(event) => setActionDraft(event.target.value)}
            placeholder="e.g. USER_UPDATE"
          />
          <Input
            label="Entity"
            value={entityDraft}
            onChange={(event) => setEntityDraft(event.target.value)}
            placeholder="e.g. User, KycCase"
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
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set('size', event.target.value);
              next.set('page', '0');
              setSearchParams(next);
            }}
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={applyFilters}>
            <Search className="mr-2 h-4 w-4" aria-hidden />
            Apply filters
          </Button>
          <Button variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </section>

      {errorMessage ? (
        <ErrorState description={errorMessage} onRetry={() => void query.refetch()} />
      ) : (
        <section className="space-y-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={query.isLoading}
            emptyTitle="No audit entries"
            emptyDescription="No logs match the current filters. Adjust actor, action, entity, or date range."
            onRowClick={(row) => setSelected(row)}
          />
          {!query.isLoading ? (
            <Pagination
              page={page}
              totalPages={query.data?.totalPages ?? 1}
              totalElements={query.data?.totalElements ?? 0}
              onPageChange={(nextPage) => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(nextPage));
                setSearchParams(next);
              }}
            />
          ) : null}
        </section>
      )}

      <Drawer
        open={Boolean(selected)}
        title="Audit entry"
        onClose={() => setSelected(null)}
        wide
      >
        {selected ? (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">ID</dt>
              <dd className="mt-1 font-mono text-xs text-text-primary">{selected.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Timestamp
              </dt>
              <dd className="mt-1 text-text-primary">{formatDateTime(selected.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Actor</dt>
              <dd className="mt-1 text-sm text-text-primary">{selected.actorEmail || '—'}</dd>
              {selected.userRef ? (
                <dd className="mt-1 font-mono text-xs text-text-muted">{selected.userRef}</dd>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Action
                </dt>
                <dd className="mt-1">
                  <Badge tone="neutral">{selected.action}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Entity
                </dt>
                <dd className="mt-1 text-text-primary">{selected.entity || '—'}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Before (oldValue)
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-surface-secondary/60 p-3 font-mono text-xs text-text-secondary">
                {selected.oldValue || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                After (newValue)
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-surface-secondary/60 p-3 font-mono text-xs text-text-secondary">
                {selected.newValue || '—'}
              </dd>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  IP address
                </dt>
                <dd className="mt-1 font-mono text-xs text-text-primary">
                  {selected.ipAddress || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Device
                </dt>
                <dd className="mt-1 text-text-primary">{selected.device || '—'}</dd>
              </div>
            </div>
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}
