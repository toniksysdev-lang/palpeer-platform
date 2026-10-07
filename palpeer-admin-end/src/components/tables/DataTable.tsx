import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';

export type DataColumn<T> = {
  id: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = 'No results',
  emptyDescription = 'There is nothing to show for the current query.',
  onRowClick,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-[0.6rem] border border-border bg-surface p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState description={error} onRetry={onRetry} />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-[0.6rem] border border-border bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-secondary/70 text-xs uppercase tracking-wide text-text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" className={cn('px-4 py-3 font-semibold', column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-t border-border transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-surface-secondary/50',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td key={column.id} className={cn('px-4 py-3 align-middle text-text-primary', column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
