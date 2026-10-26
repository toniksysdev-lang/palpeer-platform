import type { ProviderPoolBalance, PoolFundsBalances } from '@/types/poolFunds';
import type { AdminReportsSummary } from '@/types/reports';

export type LiquidityPoolRow = {
  currencyCode: string;
  /** Pool fund − total user wallet available balance. */
  amount: number;
  poolFund: number;
  walletTotal: number;
};

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Prefer live provider balance; fall back to booked pool. */
export function poolFundAmount(row: ProviderPoolBalance | null | undefined): number | null {
  if (!row || !row.available) return null;
  return toNumber(row.liveBalance ?? row.balance);
}

/**
 * Liquidity per implemented pool rail: CAD (Apaylo) and NGN (Kuda, else Korapay).
 * Amount = pool fund − sum of user wallet available balances for that currency.
 */
export function liquidityPoolRows(
  pool: PoolFundsBalances | undefined,
  summary: AdminReportsSummary | undefined,
): LiquidityPoolRow[] {
  if (!pool) return [];

  const walletByCode = new Map<string, number>();
  for (const row of summary?.wallets.balancesByCurrency ?? []) {
    const total = toNumber(row.availableTotal) ?? 0;
    walletByCode.set(row.currencyCode.toUpperCase(), total);
  }

  const rails: Array<{ currencyCode: string; provider: ProviderPoolBalance }> = [];
  if (pool.apaylo?.available) {
    rails.push({ currencyCode: 'CAD', provider: pool.apaylo });
  }
  const ngn = pool.kuda?.available ? pool.kuda : pool.korapay?.available ? pool.korapay : null;
  if (ngn) {
    rails.push({ currencyCode: 'NGN', provider: ngn });
  }

  const rows: LiquidityPoolRow[] = [];
  for (const rail of rails) {
    const fund = poolFundAmount(rail.provider);
    if (fund == null) continue;
    const walletTotal = walletByCode.get(rail.currencyCode) ?? 0;
    rows.push({
      currencyCode: rail.currencyCode,
      poolFund: fund,
      walletTotal,
      amount: fund - walletTotal,
    });
  }
  return rows;
}
