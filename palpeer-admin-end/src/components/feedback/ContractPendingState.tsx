import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ContractPendingState({
  title = 'Not available yet',
  description = 'This module is not available yet.',
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-[0.6rem] border border-dashed border-warning/40 bg-warning/5 p-6',
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-2 text-warning">
        <AlertTriangle className="h-5 w-5" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">Coming later</span>
      </div>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}
