import {
  sortedCounts,
  volumeByCurrency,
} from '@/features/reports/summaryHelpers';
import { formatDecimal, formatInteger, formatStatusLabel } from '@/lib/format';
import type { CountsByKey, TransactionSuccessVolume } from '@/types/reports';

function barWidth(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '0%';
  return `${Math.max(2, Math.round((value / max) * 100))}%`;
}

export function StatusBars({
  counts,
  emptyLabel = 'No records.',
}: {
  counts: CountsByKey;
  emptyLabel?: string;
}) {
  const rows = sortedCounts(counts);
  const max = rows[0]?.[1] ?? 0;
  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map(([status, count]) => (
        <li key={status}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-text-secondary">{formatStatusLabel(status)}</span>
            <span className="font-mono text-text-primary">{formatInteger(count)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-secondary">
            <div className="h-2 rounded-full bg-primary" style={{ width: barWidth(count, max) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VolumeBars({
  rows,
  emptyLabel = 'No successful transactions in this window.',
}: {
  rows: TransactionSuccessVolume[];
  emptyLabel?: string;
}) {
  const groups = volumeByCurrency(rows);
  if (groups.length === 0) {
    return <p className="text-sm text-text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const max = Math.max(...group.rows.map((row) => Number(row.amount) || 0));
        return (
          <div key={group.currencyCode}>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {group.currencyCode}
            </p>
            <ul className="mt-2 space-y-2">
              {group.rows.map((row) => (
                <li key={`${row.type}-${row.currencyCode}`}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-text-secondary">
                      {formatStatusLabel(row.type)} · {formatInteger(row.count)} tx
                    </span>
                    <span className="font-mono text-text-primary">
                      {formatDecimal(row.amount, 2)} {row.currencyCode}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-secondary">
                    <div
                      className="h-2 rounded-full bg-success"
                      style={{ width: barWidth(Number(row.amount) || 0, max) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-xs text-text-muted">
        Amounts are compared only within the same currency.
      </p>
    </div>
  );
}
