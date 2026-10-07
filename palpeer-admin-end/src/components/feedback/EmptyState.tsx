import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-[0.6rem] border border-dashed border-border bg-surface-secondary/40 p-5',
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-2 text-text-muted">
        <Inbox className="h-5 w-5" aria-hidden />
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <p className="text-sm text-text-secondary">{description}</p>
    </div>
  );
}
