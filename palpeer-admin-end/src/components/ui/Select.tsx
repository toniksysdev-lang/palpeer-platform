import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <label className="block space-y-1.5" htmlFor={selectId}>
        <span className="mb-1 block text-sm font-medium text-text-primary">{label}</span>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-11 w-full rounded-[0.6rem] border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error ? <span className="block text-xs text-danger">{error}</span> : null}
      </label>
    );
  },
);

Select.displayName = 'Select';
