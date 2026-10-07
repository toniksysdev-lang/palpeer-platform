import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-secondary text-text-secondary border-border',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
  primary: 'bg-primary/10 text-primary border-primary/20',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
