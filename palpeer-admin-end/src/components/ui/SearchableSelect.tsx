import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Extra text included in the filter (e.g. ISO code). Defaults to value + label. */
  keywords?: string;
};

export type SearchableSelectProps = {
  label: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Labeled combobox: type to filter a long option list, then pick one value.
 */
export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyMessage = 'No matches.',
  error,
  disabled,
  id,
  className,
}: SearchableSelectProps) {
  const reactId = useId();
  const selectId = id ?? `searchable-select-${reactId}`;
  const listId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((o) => {
      const hay = normalize(`${o.label} ${o.value} ${o.keywords ?? ''}`);
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (open && option) pick(option.value);
      else setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  const displayValue = open ? query : selected?.label ?? '';

  return (
    <div ref={rootRef} className={cn('relative block space-y-1.5', className)}>
      <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={selectId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={!!error}
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={onKeyDown}
          className={cn(
            'h-11 w-full rounded-[0.6rem] border border-border bg-surface py-2 pl-10 pr-10 text-sm text-text-primary outline-none transition-smooth placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
          )}
          autoComplete="off"
        />
        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </div>
      {error ? <span className="block text-xs text-danger">{error}</span> : null}

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-[0.6rem] border border-border bg-surface p-1 shadow-card"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted">{emptyMessage}</p>
          ) : (
            <ul>
              {filtered.map((option, index) => (
                <li key={option.value} role="option" aria-selected={option.value === value}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary',
                      index === activeIndex && 'bg-surface-secondary',
                      option.value === value && 'font-medium text-primary',
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
