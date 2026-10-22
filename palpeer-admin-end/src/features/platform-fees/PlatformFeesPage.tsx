import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Banknote, Download, Scale, Search } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { KpiCard } from '@/components/data-display/KpiCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { saveBlob } from '@/services/api/client';
import {
  exportPlatformFees,
  getPlatformFeeSummary,
  searchPlatformFees,
} from '@/services/api/platformFees';
import { ApiClientError } from '@/types/api';
import type {
  PlatformFeeCurrencyTotal,
  PlatformFeeRevenue,
  PlatformFeeSourceType,
} from '@/types/fees';

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

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

function sourceLabel(source: PlatformFeeSourceType): string {
  return source === 'INSTANT_EX' ? 'InstantEX' : 'P2P';
}

function totalCount(rows: PlatformFeeCurrencyTotal[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0);
}

function TotalsDisplay({ rows }: { rows: PlatformFeeCurrencyTotal[] | undefined }) {
  const lines = rows ?? [];
  if (lines.length === 0) {
    return <p className="font-mono text-2xl font-semibold tracking-tight text-text-primary">0</p>;
  }
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <p
          key={line.currencyCode}
          className="font-mono text-2xl font-semibold tracking-tight text-text-primary"
        >
          {formatDecimal(line.amount)}{' '}
          <span className="text-base font-medium text-text-secondary">{line.currencyCode}</span>
        </p>
      ))}
    </div>
  );
}

export function PlatformFeesPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const allowed = can('reports:read') || can('fees:read');
  const [searchParams, setSearchParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);

  const sourceType = (searchParams.get('sourceType') ?? '') as PlatformFeeSourceType | '';
  const currency = searchParams.get('currency') ?? '';
  const q = searchParams.get('q') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const [qDraft, setQDraft] = useState(q);
  const [currencyDraft, setCurrencyDraft] = useState(currency);
  const [sourceDraft, setSourceDraft] = useState(sourceType);
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);

  useEffect(() => {
    setQDraft(q);
    setCurrencyDraft(currency);
    setSourceDraft(sourceType);
    setFromDraft(from);
    setToDraft(to);
  }, [q, currency, sourceType, from, to]);

  const filterArgs = {
    currency: currency || undefined,
    q: q || undefined,
    from: localInputToIso(from),
    to: localInputToIso(to, true),
  };

  const summaryQuery = useQuery({
    queryKey: ['platform-fees-summary', currency, q, from, to, appConfig.useMockApi],
    enabled: allowed && !appConfig.useMockApi,
    queryFn: () => getPlatformFeeSummary(filterArgs),
  });

  const query = useQuery({
    queryKey: ['platform-fees', sourceType, currency, q, from, to, page, size, appConfig.useMockApi],
    enabled: allowed && !appConfig.useMockApi,
    queryFn: () =>
      searchPlatformFees({
        sourceType: sourceType || undefined,
        ...filterArgs,
        page,
        size,
        sort: 'createdAt,desc',
      }),
  });

  const columns = useMemo<DataColumn<PlatformFeeRevenue>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'Recorded',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: (row) => (
          <Badge tone={row.sourceType === 'P2P' ? 'info' : 'neutral'}>
            {sourceLabel(row.sourceType)}
          </Badge>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => (
          <span className="font-mono text-sm">
            {formatDecimal(row.amount)} {row.currencyCode}
          </span>
        ),
      },
      {
        id: 'user',
        header: 'User',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-xs">{row.userEmail ?? row.userId}</p>
          </div>
        ),
      },
      {
        id: 'reference',
        header: 'Reference',
        cell: (row) => (
          <span className="font-mono text-xs text-text-secondary">
            {row.referenceType}:{row.referenceId.slice(0, 8)}…
          </span>
        ),
      },
      {
        id: 'detail',
        header: '',
        cell: (row) => (
          <Link
            to={`/admin/platform-fees/${row.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View
          </Link>
        ),
      },
    ],
    [],
  );

  function applyFilters() {
    const next = new URLSearchParams();
    if (sourceDraft) next.set('sourceType', sourceDraft);
    if (currencyDraft.trim()) next.set('currency', currencyDraft.trim().toUpperCase());
    if (qDraft.trim()) next.set('q', qDraft.trim());
    if (fromDraft) next.set('from', fromDraft);
    if (toDraft) next.set('to', toDraft);
    next.set('page', '0');
    next.set('size', String(size));
    setSearchParams(next);
  }

  async function onExport() {
    setExporting(true);
    try {
      const content = await exportPlatformFees({
        sourceType: sourceType || undefined,
        currency: currency || undefined,
        q: q || undefined,
        from: localInputToIso(from),
        to: localInputToIso(to, true),
      });
      saveBlob(
        content.blob,
        content.filename ?? `palpeer-platform-revenue-${todayStamp()}.xls`,
      );
      push({
        tone: 'success',
        title: 'Export ready',
        description: 'Excel file downloaded (max 5,000 rows, current filters applied).',
      });
    } catch (error) {
      push({
        tone: 'error',
        title: 'Export failed',
        description:
          error instanceof ApiClientError ? error.message : 'Could not export platform revenue.',
      });
    } finally {
      setExporting(false);
    }
  }

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="reports:read or fees:read is required to view platform fee revenue."
      />
    );
  }

  if (appConfig.useMockApi) {
    return (
      <ErrorState
        title="Live API required"
        description="Platform fee revenue is not available in mock API mode."
      />
    );
  }

  const pageData = query.data;
  const summary = summaryQuery.data;
  const summaryState =
    summaryQuery.isLoading || summaryQuery.isFetching
      ? 'loading'
      : summaryQuery.isError
        ? 'error'
        : 'ready';

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold text-text-primary">Platform Revenue</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Recorded platform fees from P2P settlements and InstantEX executions (wallet debits).
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Grand Total"
          icon={Banknote}
          state={summaryState}
          display={<TotalsDisplay rows={summary?.grandTotal} />}
          hint={
            summaryState === 'ready'
              ? `${totalCount(summary?.grandTotal)} fee${totalCount(summary?.grandTotal) === 1 ? '' : 's'} · all sources`
              : 'All recorded platform fees'
          }
        />
        <KpiCard
          label="Total InstantEX"
          icon={ArrowLeftRight}
          state={summaryState}
          display={<TotalsDisplay rows={summary?.instantExTotal} />}
          hint={
            summaryState === 'ready'
              ? `${totalCount(summary?.instantExTotal)} InstantEX fee${totalCount(summary?.instantExTotal) === 1 ? '' : 's'}`
              : 'Fees from InstantEX executions'
          }
        />
        <KpiCard
          label="Total P2P"
          icon={Scale}
          state={summaryState}
          display={<TotalsDisplay rows={summary?.p2pTotal} />}
          hint={
            summaryState === 'ready'
              ? `${totalCount(summary?.p2pTotal)} P2P fee${totalCount(summary?.p2pTotal) === 1 ? '' : 's'}`
              : 'Fees from P2P settlements'
          }
        />
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Source"
            value={sourceDraft}
            onChange={(e) => setSourceDraft(e.target.value as PlatformFeeSourceType | '')}
          >
            <option value="">All sources</option>
            <option value="P2P">P2P</option>
            <option value="INSTANT_EX">InstantEX</option>
          </Select>
          <Input
            label="Currency"
            value={currencyDraft}
            onChange={(e) => setCurrencyDraft(e.target.value)}
            placeholder="e.g. USD"
          />
          <Input
            label="Search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Description, reference id, user id…"
          />
          <Input
            label="From"
            type="date"
            value={fromDraft}
            onChange={(e) => setFromDraft(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={toDraft}
            onChange={(e) => setToDraft(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={applyFilters} className="gap-2">
              <Search className="h-4 w-4" aria-hidden />
              Search
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              disabled={exporting}
              onClick={() => void onExport()}
            >
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <DataTable
          columns={columns}
          rows={pageData?.content ?? []}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          error={
            query.error instanceof ApiClientError
              ? query.error.message
              : query.error
                ? 'Failed to load platform fees.'
                : null
          }
          onRetry={() => void query.refetch()}
          emptyTitle="No fee revenue"
          emptyDescription="Fees appear here after P2P orders settle or InstantEX trades execute with a matching tier."
        />
        {pageData && pageData.totalPages > 1 ? (
          <div className="mt-4">
            <Pagination
              page={pageData.number}
              totalPages={pageData.totalPages}
              totalElements={pageData.totalElements}
              onPageChange={(nextPage) => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(nextPage));
                setSearchParams(next);
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
