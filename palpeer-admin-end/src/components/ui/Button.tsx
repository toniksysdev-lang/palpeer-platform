import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover disabled:opacity-50',
  secondary:
    'border border-border bg-surface text-text-primary shadow-sm hover:bg-surface-secondary disabled:opacity-50',
  ghost: 'border border-transparent bg-transparent text-text-secondary hover:bg-primary/10 hover:text-primary',
  danger:
    'border border-danger bg-danger text-white shadow-sm hover:bg-danger/90 disabled:opacity-50',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
  icon: 'h-10 w-10',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[0.6rem] font-medium leading-none transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
