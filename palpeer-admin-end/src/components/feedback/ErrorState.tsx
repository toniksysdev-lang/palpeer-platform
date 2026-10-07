import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-[0.6rem] border border-danger/30 bg-danger/5 p-5',
        className,
      )}
      role="alert"
    >
      <div className="flex items-center gap-2 text-danger">
        <AlertCircle className="h-5 w-5" aria-hidden />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-text-secondary">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
