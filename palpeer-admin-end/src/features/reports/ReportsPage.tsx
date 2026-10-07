import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileBarChart2, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { StatusBars, VolumeBars } from '@/features/reports/SummaryBars';
import {
  pendingKycCount,
  sortedCounts,
  statusPairs,
  totalCount,
} from '@/features/reports/summaryHelpers';
import { formatDate, formatDateTime, formatDecimal, formatInteger, formatStatusLabel } from '@/lib/format';
import { mockExportReportDataset, mockReportsSummary } from '@/mocks/reports';
import { saveBlob } from '@/services/api/client';
import { exportReportDataset, getReportsSummary } from '@/services/api/reports';
import { ApiClientError } from '@/types/api';
import type {
  BonusAmountByStatusAndCurrency,
  ReportDataset,
  ReportWindow,
  WalletCurrencyBalance,
} from '@/types/reports';

const DATASET_LABELS: Record<ReportDataset, string> = {
  users: 'Users',
  'kyc-cases': 'KYC cases',
  wallets: 'Wallets',
  transactions: 'Transactions',
  'p2p-requests': 'P2P requests',
  'p2p-orders': 'P2P orders',
  'audit-logs': 'Audit logs',
};

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

function ReportSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          {description ? <p className="mt-1 text-xs text-text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export function ReportsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = can('reports:read');
  const canAudit = can('audit:read');

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);
  const [exporting, setExporting] = useState<ReportDataset | null>(null);

  useEffect(() => {
    setFromDraft(from);
    setToDraft(to);
  }, [from, to]);

  const reportWindow = useMemo<ReportWindow>(
    () => ({ from: localInputToIso(from), to: localInputToIso(to, true) }),
    [from, to],
  );

  const query = useQuery({
    queryKey: ['admin-reports-summary', reportWindow, appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return mockReportsSummary(reportWindow);
      }
      return getReportsSummary(reportWindow);
    },
  });

  function applyWindow(event?: FormEvent) {
    event?.preventDefault();
    const next = new URLSearchParams();
    if (fromDraft) next.set('from', fromDraft);
    if (toDraft) next.set('to', toDraft);
    setSearchParams(next);
  }

  async function onExport(dataset: ReportDataset) {
    setExporting(dataset);
    try {
      const content = appConfig.useMockApi
        ? mockExportReportDataset(dataset, reportWindow)
        : await exportReportDataset(dataset, reportWindow);
      saveBlob(content.blob, content.filename ?? `palpeer-${dataset}-${todayStamp()}.csv`);
      push({
        tone: 'success',
        title: 'Export ready',
        description: `${DATASET_LABELS[dataset]} CSV downloaded (max 5,000 rows).`,
      });
    } catch (error) {
      push({
        tone: 'error',
        title: 'Export failed',
        description: error instanceof ApiClientError ? error.message : 'Could not export this dataset.',
      });
    } finally {
      setExporting(null);
    }
  }

  function exportButton(dataset: ReportDataset) {
    return (
      <Button
        key={dataset}
        variant="secondary"
        size="sm"
        disabled={exporting !== null}
        onClick={() => void onExport(dataset)}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {exporting === dataset ? 'Exporting…' : `Export ${DATASET_LABELS[dataset]}`}
      </Button>
    );
  }

  const balanceColumns = useMemo<DataColumn<WalletCurrencyBalance>[]>(
    () => [
      { id: 'currency', header: 'Currency', cell: (row) => <Badge tone="neutral">{row.currencyCode}</Badge> },
      { id: 'wallets', header: 'Wallets', cell: (row) => formatInteger(row.walletCount) },
      {
        id: 'available',
        header: 'Available total',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.availableTotal)}</span>,
      },
      {
        id: 'pending',
        header: 'Pending total',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.pendingTotal)}</span>,
      },
    ],
    [],
  );

  const bonusAmountColumns = useMemo<DataColumn<BonusAmountByStatusAndCurrency>[]>(
    () => [
      { id: 'status', header: 'Status', cell: (row) => formatStatusLabel(row.status) },
      { id: 'currency', header: 'Currency', cell: (row) => row.currencyCode },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.amount)}</span>,
      },
    ],
    [],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="reports:read is required to view reports and exports."
      />
    );
  }

  const summary = query.data;
  const typeStatus = summary ? statusPairs(summary.transactions.countsByTypeAndStatus) : {};
  const txStatuses = [...new Set(Object.values(typeStatus).flatMap((counts) => Object.keys(counts)))].sort();

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Reports</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Read-only platform totals. User, KYC, wallet, card, referral, and bonus figures are all-time totals; transaction
              figures use the selected window (default: last 30 days). The platform has no fee model,
              so no revenue is reported.
            </p>
          </div>
        </div>

        <form className="mt-4 grid items-end gap-3 md:grid-cols-[12rem_12rem_auto]" onSubmit={applyWindow}>
          <Input label="From" type="date" value={fromDraft} onChange={(event) => setFromDraft(event.target.value)} />
          <Input label="To" type="date" value={toDraft} onChange={(event) => setToDraft(event.target.value)} />
          <div className="flex gap-2">
            <Button type="submit">
              <Search className="h-3.5 w-3.5" aria-hidden />
              Apply
            </Button>
            {from || to ? (
              <Button type="button" variant="secondary" onClick={() => setSearchParams(new URLSearchParams())}>
                Last 30 days
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => void query.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </Button>
          </div>
        </form>
        {summary ? (
          <p className="mt-3 text-xs text-text-muted">
            Window {formatDate(summary.from)} – {formatDate(summary.to)} · generated{' '}
            {formatDateTime(summary.generatedAt)}
          </p>
        ) : null}
      </section>

      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {query.isError ? (
        <ErrorState
          description={query.error instanceof ApiClientError ? query.error.message : 'Failed to load the summary.'}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="Users" description="All-time totals by account status." actions={exportButton('users')}>
              <Stat label="Total users" value={formatInteger(summary.users.total)} />
              <div className="mt-4">
                <StatusBars counts={summary.users.byStatus} />
              </div>
            </ReportSection>

            <ReportSection
              title="KYC"
              description="All-time totals by case status."
              actions={exportButton('kyc-cases')}
            >
              <div className="flex flex-wrap gap-8">
                <Stat label="Total cases" value={formatInteger(summary.kyc.total)} />
                <Stat label="Review queue" value={formatInteger(pendingKycCount(summary.kyc.byStatus))} />
              </div>
              <div className="mt-4">
                <StatusBars counts={summary.kyc.byStatus} />
              </div>
              <Link to="/admin/kyc?status=SUBMITTED" className="mt-3 inline-flex text-xs text-primary hover:underline">
                Open review queue →
              </Link>
            </ReportSection>
          </div>

          <ReportSection
            title="Wallets"
            description="All-time wallet count and balance totals per currency."
            actions={exportButton('wallets')}
          >
            <Stat label="Total wallets" value={formatInteger(summary.wallets.total)} />
            <div className="mt-4">
              <DataTable
                columns={balanceColumns}
                rows={summary.wallets.balancesByCurrency}
                rowKey={(row) => row.currencyCode}
                emptyTitle="No wallets"
                emptyDescription="No wallet balances were reported."
              />
            </div>
          </ReportSection>

          <ReportSection
            title="Transactions"
            description="Counts and successful volume within the selected window."
            actions={exportButton('transactions')}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-text-primary">
                  Count by type ({formatInteger(totalCount(summary.transactions.countsByType))})
                </p>
                <StatusBars counts={summary.transactions.countsByType} emptyLabel="No transactions in this window." />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text-primary">Successful volume</p>
                <VolumeBars rows={summary.transactions.successVolume} />
              </div>
            </div>
            {Object.keys(typeStatus).length > 0 ? (
              <div className="mt-6 overflow-x-auto rounded-[0.6rem] border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-surface-secondary/70 text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-semibold">
                        Type
                      </th>
                      {txStatuses.map((status) => (
                        <th key={status} scope="col" className="px-4 py-2 text-right font-semibold">
                          {formatStatusLabel(status)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(typeStatus)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([type, counts]) => (
                        <tr key={type} className="border-t border-border">
                          <td className="px-4 py-2 font-medium text-text-primary">{formatStatusLabel(type)}</td>
                          {txStatuses.map((status) => (
                            <td key={status} className="px-4 py-2 text-right font-mono text-xs">
                              {formatInteger(counts[status] ?? 0)}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </ReportSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              title="P2P"
              description="All-time request and order counts by status."
              actions={
                <>
                  {exportButton('p2p-requests')}
                  {exportButton('p2p-orders')}
                </>
              }
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-text-primary">
                    Requests ({formatInteger(totalCount(summary.p2p.requestsByStatus))})
                  </p>
                  <StatusBars counts={summary.p2p.requestsByStatus} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-text-primary">
                    Orders ({formatInteger(totalCount(summary.p2p.ordersByStatus))})
                  </p>
                  <StatusBars counts={summary.p2p.ordersByStatus} />
                </div>
              </div>
            </ReportSection>

            <ReportSection title="Cards" description="All-time card counts by status.">
              <Stat label="Total cards" value={formatInteger(totalCount(summary.cards.byStatus))} />
              <div className="mt-4">
                <StatusBars counts={summary.cards.byStatus} />
              </div>
            </ReportSection>

            <ReportSection title="Referrals" description="All-time referral counts by status.">
              <Stat label="Total referrals" value={formatInteger(totalCount(summary.referrals.byStatus))} />
              <div className="mt-4">
                <StatusBars counts={summary.referrals.byStatus} />
              </div>
            </ReportSection>

            <ReportSection title="Bonuses" description="All-time bonus counts and amounts by status and currency.">
              <div className="flex flex-wrap gap-2">
                {sortedCounts(summary.bonuses.byStatus).map(([status, count]) => (
                  <Badge key={status} tone="neutral">
                    {formatStatusLabel(status)} · {formatInteger(count)}
                  </Badge>
                ))}
              </div>
              <div className="mt-4">
                <DataTable
                  columns={bonusAmountColumns}
                  rows={summary.bonuses.amountByStatusAndCurrency}
                  rowKey={(row) => `${row.status}-${row.currencyCode}`}
                  emptyTitle="No bonuses"
                  emptyDescription="No bonus amounts were reported."
                />
              </div>
            </ReportSection>
          </div>

          {canAudit ? (
            <ReportSection
              title="Audit logs"
              description="Admin and security audit events created within the selected window."
              actions={exportButton('audit-logs')}
            >
              <Link to="/admin/audit" className="text-sm text-primary hover:underline">
                Open audit log search →
              </Link>
            </ReportSection>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
