import { cn } from '@/lib/cn';

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-2 ring-primary/15',
        className,
      )}
      aria-hidden
    >
      {initials || 'A'}
    </span>
  );
}
