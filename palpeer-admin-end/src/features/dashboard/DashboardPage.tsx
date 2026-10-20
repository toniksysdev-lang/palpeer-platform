import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  Banknote,
  ClipboardList,
  Gift,
  RefreshCw,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { KpiCard } from '@/components/data-display/KpiCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useDashboardData } from '@/features/dashboard/useDashboardData';
import { StatusBars, VolumeBars } from '@/features/reports/SummaryBars';
import {
  balancesByWalletCount,
  pendingKycCount,
  successCount,
  volumeByCurrency,
} from '@/features/reports/summaryHelpers';
import { formatDate, formatDateTime, formatDecimal } from '@/lib/format';

function kpiState(
  status: 'idle' | 'loading' | 'success' | 'error' | 'forbidden' | 'skipped',
): 'loading' | 'ready' | 'error' | 'forbidden' {
  if (status === 'loading' || status === 'idle') return 'loading';
  if (status === 'forbidden') return 'forbidden';
  if (status === 'error') return 'error';
  return 'ready';
}

export function DashboardPage() {
  const {
    users,
    kyc,
    p2pRequests,
    p2pOrders,
    audit,
    currencies,
    referrals,
    bonuses,
    summary,
    refetchAll,
    anyError,
  } = useDashboardData();

  const summaryData = summary.status === 'success' ? summary.data : undefined;
  const volumeGroups = summaryData ? volumeByCurrency(summaryData.transactions.successVolume) : [];
  const topBalances = summaryData ? balancesByWalletCount(summaryData.wallets.balancesByCurrency) : [];

  return (
    <div className="space-y-6">
      <section className="ki-welcome-alert p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
              Palpeer control surface
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              A live overview of users, verification, P2P activity, balances, and assessed platform
              fees across the last 30 days.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{appConfig.appEnv}</Badge>
            <Button variant="secondary" size="sm" onClick={refetchAll}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {anyError ? (
        <ErrorState
          title="Some dashboard panels failed to load"
          description="Some data could not be loaded. Individual cards show their own status; retry to reload all panels."
          onRetry={refetchAll}
        />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total users"
          icon={Users}
          state={kpiState(users.status)}
          value={users.data?.totalElements}
          hint="Total registered app users"
        />
        <KpiCard
          label="KYC cases"
          icon={ShieldCheck}
          state={kpiState(kyc.status)}
          value={kyc.data?.totalElements}
          hint="Cases in all statuses"
        />
        <KpiCard
          label="Pending KYC queue"
          icon={ShieldCheck}
          state={kpiState(summary.status)}
          value={summaryData ? pendingKycCount(summaryData.kyc.byStatus) : undefined}
          hint={
            <>
              Submitted + under review ·{' '}
              <Link to="/admin/kyc?status=SUBMITTED" className="text-primary hover:underline">
                Open queue
              </Link>
            </>
          }
        />
        <KpiCard
          label="P2P requests"
          icon={Scale}
          state={kpiState(p2pRequests.status)}
          value={p2pRequests.data?.length}
          hint="Open P2P requests listed"
        />
        <KpiCard
          label="P2P orders"
          icon={Activity}
          state={kpiState(p2pOrders.status)}
          value={p2pOrders.data?.length}
          hint="P2P orders listed"
        />
        <KpiCard
          label="Referrals"
          icon={Gift}
          state={kpiState(referrals.status)}
          value={referrals.data?.totalElements}
          hint="Total referrals recorded"
        />
        <KpiCard
          label="Bonuses"
          icon={Banknote}
          state={kpiState(bonuses.status)}
          value={bonuses.data?.totalElements}
          hint="Total bonuses issued"
        />
        <KpiCard
          label="Transaction volume"
          icon={Banknote}
          state={kpiState(summary.status)}
          value={summaryData ? successCount(summaryData.transactions.successVolume) : undefined}
          hint={
            summaryData ? (
              volumeGroups.length > 0 ? (
                <>
                  Successful since {formatDate(summaryData.from)} ·{' '}
                  {volumeGroups
                    .map((group) => `${group.currencyCode} ${successCount(group.rows)}`)
                    .join(' · ')}
                </>
              ) : (
                'No successful transactions in the last 30 days.'
              )
            ) : (
              'Successful funding, withdrawal, and exchange in the last 30 days'
            )
          }
        />
        <KpiCard
          label="Wallet balances"
          icon={Activity}
          state={kpiState(summary.status)}
          display={
            topBalances.length > 0 ? (
              <ul className="space-y-0.5">
                {topBalances.slice(0, 3).map((row) => (
                  <li
                    key={row.currencyCode}
                    className="flex items-baseline justify-between gap-2 font-mono text-sm text-text-primary"
                  >
                    <span className="font-semibold">{formatDecimal(row.availableTotal, 2)}</span>
                    <span className="text-xs text-text-muted">{row.currencyCode}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-2xl font-semibold text-text-muted">0</p>
            )
          }
          hint={
            summaryData
              ? `Available totals across ${formatDecimal(summaryData.wallets.total, 0)} wallets${
                  topBalances.length > 3 ? ` · +${topBalances.length - 3} more currencies` : ''
                }`
              : 'Available totals per currency'
          }
        />
        <KpiCard
          label="Platform fees / revenue"
          icon={Banknote}
          state={kpiState(summary.status)}
          display={
            summaryData?.fees?.byCurrency?.length ? (
              <ul className="space-y-0.5">
                {summaryData.fees.byCurrency.slice(0, 3).map((row) => (
                  <li
                    key={row.currencyCode}
                    className="flex items-baseline justify-between gap-2 font-mono text-sm text-text-primary"
                  >
                    <span className="font-semibold">{formatDecimal(row.amount, 2)}</span>
                    <span className="text-xs text-text-muted">{row.currencyCode}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-2xl font-semibold text-text-muted">0</p>
            )
          }
          hint={
            summaryData ? (
              <>
                Assessed on {formatDecimal(summaryData.fees?.orderCount ?? 0, 0)} completed P2P
                orders since {formatDate(summaryData.from)}
                {summaryData.fees?.byCurrency && summaryData.fees.byCurrency.length > 3
                  ? ` · +${summaryData.fees.byCurrency.length - 3} more`
                  : ''}
                {' · '}
                <Link to="/admin/fees/p2p" className="text-primary hover:underline">
                  Fee tiers
                </Link>
              </>
            ) : (
              'P2P fees assessed in the last 30 days'
            )
          }
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-text-primary">Recent users</h3>
            <Link to="/admin/users" className="text-xs font-medium text-primary hover:underline">
              View users
            </Link>
          </div>
          {users.status === 'loading' ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {users.status === 'error' ? (
            <ErrorState description={users.errorMessage ?? 'Failed to load users.'} onRetry={refetchAll} />
          ) : null}
          {users.status === 'forbidden' ? (
            <ErrorState title="Permission required" description="users:read is required for this panel." />
          ) : null}
          {users.status === 'success' && users.data?.empty ? (
            <EmptyState title="No users yet" description="When platform users register, they will appear here." />
          ) : null}
          {users.status === 'success' && users.data && !users.data.empty ? (
            <ul className="divide-y divide-border">
              {users.data.content.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/admin/users/${user.id}`}
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {user.email}
                    </Link>
                    <p className="text-xs text-text-muted">{formatDateTime(user.createdAt)}</p>
                  </div>
                  <StatusBadge status={user.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-text-primary">Recent KYC cases</h3>
            <Link to="/admin/kyc" className="text-xs font-medium text-primary hover:underline">
              View KYC
            </Link>
          </div>
          {kyc.status === 'loading' ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {kyc.status === 'error' ? (
            <ErrorState description={kyc.errorMessage ?? 'Failed to load KYC cases.'} onRetry={refetchAll} />
          ) : null}
          {kyc.status === 'forbidden' ? (
            <ErrorState title="Permission required" description="kyc:read is required for this panel." />
          ) : null}
          {kyc.status === 'success' && kyc.data?.empty ? (
            <EmptyState title="No KYC cases" description="Submitted verification cases will appear here." />
          ) : null}
          {kyc.status === 'success' && kyc.data && !kyc.data.empty ? (
            <ul className="divide-y divide-border">
              {kyc.data.content.map((item) => (
                <li key={item.caseId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/admin/kyc/${item.caseId}`}
                      state={{ case: item }}
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {item.fullName?.trim() || 'Unnamed applicant'}
                    </Link>
                    <p className="truncate text-xs text-text-muted">
                      {item.email ? (
                        <Link
                          to={`/admin/users/${item.userId}`}
                          className="text-primary hover:underline"
                        >
                          {item.email}
                        </Link>
                      ) : (
                        <Link
                          to={`/admin/users/${item.userId}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {item.userId}
                        </Link>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-text-primary">P2P snapshot</h3>
            <Link to="/admin/p2p" className="text-xs font-medium text-primary hover:underline">
              View P2P
            </Link>
          </div>
          {p2pRequests.status === 'loading' || p2pOrders.status === 'loading' ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {p2pRequests.status === 'forbidden' || p2pOrders.status === 'forbidden' ? (
            <ErrorState title="Permission required" description="p2p:read is required for this panel." />
          ) : null}
          {p2pRequests.status === 'error' || p2pOrders.status === 'error' ? (
            <ErrorState
              description={p2pRequests.errorMessage ?? p2pOrders.errorMessage ?? 'Failed to load P2P data.'}
              onRetry={refetchAll}
            />
          ) : null}
          {p2pRequests.status === 'success' &&
          p2pOrders.status === 'success' &&
          (p2pRequests.data?.length ?? 0) === 0 &&
          (p2pOrders.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No P2P activity listed"
              description="Open P2P requests and orders will show here."
            />
          ) : null}
          {p2pRequests.status === 'success' && (p2pRequests.data?.length ?? 0) > 0 ? (
            <ul className="divide-y divide-border">
              {p2pRequests.data!.slice(0, 5).map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {request.side} {request.baseCurrencyCode}/{request.quoteCurrencyCode}
                    </p>
                    <p className="text-xs text-text-muted">
                      Amount {formatDecimal(request.amount)} · Rate {formatDecimal(request.rate)}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
              <h3 className="text-base font-semibold text-text-primary">Recent audit activity</h3>
            </div>
            <Link to="/admin/audit" className="text-xs font-medium text-primary hover:underline">
              View audit
            </Link>
          </div>
          {audit.status === 'loading' ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {audit.status === 'forbidden' ? (
            <ErrorState title="Permission required" description="audit:read is required for this panel." />
          ) : null}
          {audit.status === 'error' ? (
            <ErrorState description={audit.errorMessage ?? 'Failed to load audit logs.'} onRetry={refetchAll} />
          ) : null}
          {audit.status === 'success' && audit.data?.empty ? (
            <EmptyState title="No audit events" description="Administrative actions will appear in this feed." />
          ) : null}
          {audit.status === 'success' && audit.data && !audit.data.empty ? (
            <ul className="divide-y divide-border">
              {audit.data.content.map((entry) => (
                <li key={entry.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{entry.action}</p>
                      <p className="truncate text-xs text-text-muted">
                        {entry.userRef || 'system'} · {entry.entity || '—'}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-text-muted">{formatDateTime(entry.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="text-base font-semibold text-text-primary">Configured currencies</h3>
          </div>
          {currencies.status === 'loading' ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : null}
          {currencies.status === 'error' ? (
            <ErrorState
              description={currencies.errorMessage ?? 'Failed to load currencies.'}
              onRetry={refetchAll}
            />
          ) : null}
          {currencies.status === 'success' && (currencies.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No currencies configured"
              description="Add currencies from the Rates page."
            />
          ) : null}
          {currencies.status === 'success' && (currencies.data?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-2">
              {currencies.data!.map((currency) => (
                <Badge key={currency.id} tone="primary">
                  {currency.code}
                  {currency.symbol ? ` · ${currency.symbol}` : ''}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-text-muted">
            See the Rates page for exchange rates by currency pair.
          </p>
        </section>

        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-text-primary">Volume by currency</h3>
            <Link to="/admin/reports" className="text-xs font-medium text-primary hover:underline">
              View reports
            </Link>
          </div>
          {summary.status === 'loading' || summary.status === 'idle' ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : null}
          {summary.status === 'forbidden' ? (
            <ErrorState title="Permission required" description="reports:read is required for this panel." />
          ) : null}
          {summary.status === 'error' ? (
            <ErrorState description={summary.errorMessage ?? 'Failed to load the summary.'} onRetry={refetchAll} />
          ) : null}
          {summaryData ? <VolumeBars rows={summaryData.transactions.successVolume} /> : null}
        </section>
      </div>

      {summaryData ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-text-primary">Status breakdowns</h3>
            <p className="text-xs text-text-muted">
              Generated {formatDateTime(summaryData.generatedAt)} · transaction counts cover{' '}
              {formatDate(summaryData.from)} – {formatDate(summaryData.to)}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">Users</p>
              <StatusBars counts={summaryData.users.byStatus} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">KYC</p>
              <StatusBars counts={summaryData.kyc.byStatus} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">Transactions by type</p>
              <StatusBars counts={summaryData.transactions.countsByType} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">P2P orders</p>
              <StatusBars counts={summaryData.p2p.ordersByStatus} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
