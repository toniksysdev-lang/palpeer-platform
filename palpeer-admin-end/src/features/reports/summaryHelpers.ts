import type { CountsByKey, TransactionSuccessVolume, WalletCurrencyBalance } from '@/types/reports';

export const KYC_QUEUE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'] as const;

export function pendingKycCount(byStatus: CountsByKey): number {
  return KYC_QUEUE_STATUSES.reduce((total, status) => total + (byStatus[status] ?? 0), 0);
}

export function sortedCounts(counts: CountsByKey): Array<[string, number]> {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function totalCount(counts: CountsByKey): number {
  return Object.values(counts).reduce((total, value) => total + value, 0);
}

export function balancesByWalletCount(rows: WalletCurrencyBalance[]): WalletCurrencyBalance[] {
  return [...rows].sort((a, b) => b.walletCount - a.walletCount || a.currencyCode.localeCompare(b.currencyCode));
}

export function volumeByCurrency(
  rows: TransactionSuccessVolume[],
): Array<{ currencyCode: string; rows: TransactionSuccessVolume[] }> {
  const groups = new Map<string, TransactionSuccessVolume[]>();
  for (const row of rows) {
    groups.set(row.currencyCode, [...(groups.get(row.currencyCode) ?? []), row]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([currencyCode, group]) => ({
      currencyCode,
      rows: [...group].sort((a, b) => a.type.localeCompare(b.type)),
    }));
}

export function successCount(rows: TransactionSuccessVolume[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

export function statusPairs(countsByTypeAndStatus: CountsByKey): Record<string, CountsByKey> {
  const byType: Record<string, CountsByKey> = {};
  for (const [key, count] of Object.entries(countsByTypeAndStatus)) {
    const [type = key, status = 'UNKNOWN'] = key.split(':');
    byType[type] = { ...byType[type], [status]: count };
  }
  return byType;
}
