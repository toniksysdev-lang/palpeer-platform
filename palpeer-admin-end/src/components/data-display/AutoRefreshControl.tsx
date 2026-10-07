import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';

export const AUTO_REFRESH_INTERVAL_MS = 15_000;

export function AutoRefreshControl({
  enabled,
  onToggle,
  updatedAt,
  fetching,
  onRefresh,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  updatedAt: number;
  fetching?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="inline-flex cursor-pointer items-center gap-2 text-text-secondary">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        Auto-refresh (15s)
      </label>
      {onRefresh ? (
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={fetching}>
          <RefreshCw className={fetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden />
          Refresh
        </Button>
      ) : null}
      <span className="text-xs text-text-muted">
        Last updated: {updatedAt ? formatDateTime(new Date(updatedAt).toISOString()) : '—'}
      </span>
    </div>
  );
}
