import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useToast, type ToastTone } from '@/app/providers/ToastProvider';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const icons: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const tones: Record<ToastTone, string> = {
  success: 'border-success/30 bg-surface',
  error: 'border-danger/30 bg-surface',
  warning: 'border-warning/30 bg-surface',
  info: 'border-info/30 bg-surface',
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.tone];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto animate-toast-in rounded-[0.6rem] border p-3 shadow-raised',
              tones[toast.tone],
            )}
            role="status"
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-xs text-text-secondary">{toast.description}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
