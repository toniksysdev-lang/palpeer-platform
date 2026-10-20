import { useQuery } from '@tanstack/react-query';
import { Landmark, RefreshCw, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/data-display/KpiCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getPoolFundsBalances } from '@/services/api/poolFunds';
import { formatDecimal } from '@/lib/format';
import type { ProviderPoolBalance } from '@/types/poolFunds';

function balanceState(
  balance: ProviderPoolBalance | undefined,
  isLoading: boolean,
  isError: boolean,
): 'loading' | 'ready' | 'error' | 'unavailable' {
  if (isLoading) return 'loading';
  if (isError) return 'error';
  // Show booked totals whenever the API returned a card; only hide when completely missing.
  if (!balance?.available) return 'unavailable';
  return 'ready';
}

function BalanceCard({
  title,
  icon: Icon,
  balance,
  isLoading,
  isError,
}: {
  title: string;
  icon: typeof Landmark;
  balance: ProviderPoolBalance | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const state = balanceState(balance, isLoading, isError);
  const currency = balance?.currencyCode ?? '—';
  const hasLive = balance?.liveBalance != null;
  const displayAmount = hasLive ? balance?.liveBalance : balance?.balance;
  const hint = !balance?.configured
    ? 'Provider not configured'
    : hasLive
      ? balance?.pendingBalance != null && Number(balance.pendingBalance) > 0
        ? `Pending ${formatDecimal(balance.pendingBalance, 2)} ${currency}`
        : 'Live provider balance'
      : 'Booked pool (live settlement unavailable)';

  return (
    <KpiCard
      label={title}
      icon={Icon}
      state={state === 'ready' && !balance?.configured ? 'unavailable' : state}
      display={
        state === 'ready' && balance?.configured ? (
          <div className="space-y-2">
            <p className="font-mono text-2xl font-semibold tracking-tight text-text-primary">
              {formatDecimal(displayAmount, 2)}{' '}
              <span className="text-base font-medium text-text-secondary">{currency}</span>
            </p>
            <p className="text-xs text-text-secondary">
              Funded{' '}
              <span className="font-mono text-text-primary">
                {formatDecimal(balance?.fundedTotal ?? 0, 2)}
              </span>
              {' · '}
              withdrawn{' '}
              <span className="font-mono text-text-primary">
                {formatDecimal(balance?.withdrawnTotal ?? 0, 2)}
              </span>
            </p>
            <p className="text-xs text-text-secondary">
              InstantEX in{' '}
              <span className="font-mono text-text-primary">
                {formatDecimal(balance?.instantExReceivedTotal ?? 0, 2)}
              </span>
              {' · '}
              out{' '}
              <span className="font-mono text-text-primary">
                {formatDecimal(balance?.instantExPaidTotal ?? 0, 2)}
              </span>
            </p>
          </div>
        ) : undefined
      }
      hint={hint}
    />
  );
}

export function PoolFundsPage() {
  const query = useQuery({
    queryKey: ['admin', 'pool-funds'],
    queryFn: getPoolFundsBalances,
  });

  return (
    <div className="space-y-6">
      <section className="ki-welcome-alert p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Treasury</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Pool Funds</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Live settlement balances from each payment rail, adjusted by successful wallet funding,
              withdrawals, and InstantEX (source currency in, target currency out). Apaylo is CAD;
              Korapay and Kuda are NGN (InstantEX NGN uses Korapay).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">Live provider</Badge>
            <Button variant="secondary" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {query.isError ? (
        <ErrorState
          title="Could not load pool balances"
          description="Check that the API is running and your admin account has wallets:read."
          onRetry={() => query.refetch()}
        />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <BalanceCard
          title="Apaylo (CAD)"
          icon={Landmark}
          balance={query.data?.apaylo}
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <BalanceCard
          title="Korapay (NGN)"
          icon={WalletCards}
          balance={query.data?.korapay}
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <BalanceCard
          title="Kuda (NGN)"
          icon={WalletCards}
          balance={query.data?.kuda}
          isLoading={query.isLoading}
          isError={query.isError}
        />
      </section>
    </div>
  );
}
