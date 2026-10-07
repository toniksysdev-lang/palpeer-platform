import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 animate-fade-in"
        aria-label="Close dialog"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="relative w-full max-w-md animate-fade-in rounded-[0.6rem] border border-border bg-surface p-5 shadow-raised">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
            className={cn(busy && 'opacity-70')}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
