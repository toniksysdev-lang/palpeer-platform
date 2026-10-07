import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function Drawer({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 animate-fade-in"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-surface shadow-raised animate-fade-in',
          wide ? 'max-w-xl' : 'max-w-md',
        )}
      >
        <div className="flex h-[var(--header-height)] items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
