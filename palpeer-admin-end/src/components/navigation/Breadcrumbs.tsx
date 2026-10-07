import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-text-muted">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden /> : null}
            {item.href && !isLast ? (
              <Link to={item.href} className="transition-colors hover:text-text-primary">
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'font-medium text-text-secondary')}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
