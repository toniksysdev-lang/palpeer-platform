import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <label className="block space-y-1.5" htmlFor={inputId}>
        <span className="mb-1 block text-sm font-medium text-text-primary">{label}</span>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-[0.6rem] border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...props}
        />
        {error ? <span className="block text-xs text-danger">{error}</span> : null}
      </label>
    );
  },
);

Input.displayName = 'Input';
