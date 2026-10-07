import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function Pagination({
  page,
  totalPages,
  totalElements,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const canPrev = page > 0;
  const canNext = page < safeTotalPages - 1;

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-xs text-text-muted">
        Page {page + 1} of {safeTotalPages} · {totalElements} total
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
