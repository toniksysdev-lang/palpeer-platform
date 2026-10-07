import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/cn';

type KpiState = 'loading' | 'ready' | 'error' | 'unavailable' | 'forbidden';

export function KpiCard({
  label,
  value,
  display,
  hint,
  icon: Icon,
  state = 'ready',
  className,
}: {
  label: string;
  value?: number | null;
  display?: ReactNode;
  hint: ReactNode;
  icon: LucideIcon;
  state?: KpiState;
  className?: string;
}) {
  return (
    <article className={cn('rounded-[0.6rem] border border-border bg-surface p-4 shadow-card', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        <Icon className="h-4 w-4 text-text-muted" aria-hidden />
      </div>
      <div className="mt-4 space-y-2">
        {state === 'loading' ? <Skeleton className="h-8 w-24" /> : null}
        {state === 'ready' ? (
          display !== undefined ? (
            display
          ) : (
            <p className="font-mono text-2xl font-semibold tracking-tight text-text-primary">
              {formatInteger(value)}
            </p>
          )
        ) : null}
        {state === 'unavailable' ? (
          <div className="space-y-1">
            <p className="font-mono text-2xl font-semibold text-text-muted">—</p>
            <Badge tone="warning">Not available yet</Badge>
          </div>
        ) : null}
        {state === 'forbidden' ? (
          <div className="space-y-1">
            <p className="font-mono text-2xl font-semibold text-text-muted">—</p>
            <Badge tone="danger">No permission</Badge>
          </div>
        ) : null}
        {state === 'error' ? (
          <div className="space-y-1">
            <p className="font-mono text-2xl font-semibold text-danger">!</p>
            <Badge tone="danger">Unavailable</Badge>
          </div>
        ) : null}
        <p className="text-xs leading-relaxed text-text-muted">{hint}</p>
      </div>
    </article>
  );
}
