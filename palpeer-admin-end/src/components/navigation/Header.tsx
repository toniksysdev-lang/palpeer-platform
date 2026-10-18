import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Loader2, Menu, Monitor, Moon, Search, Sun } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useShell } from '@/app/providers/ShellProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { appConfig } from '@/config/env';
import { findNavItem } from '@/config/navigation';
import { cn } from '@/lib/cn';
import { formatStatusLabel } from '@/lib/format';
import { mockAdminSearch } from '@/mocks/search';
import { ADMIN_SEARCH_MIN_LENGTH, adminSearch } from '@/services/api/search';
import { getAdminUser } from '@/services/api/users';
import { ApiClientError } from '@/types/api';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SEARCH_DEBOUNCE_MS = 300;

type SearchOption = {
  key: string;
  label: string;
  detail: string;
  tag: string;
  path: string;
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const navItem = findNavItem(location.pathname);
  const crumb = navItem?.label ?? 'Admin';
  const { toggleMobileNav } = useShell();
  const { mode, cycleMode } = useTheme();
  const { push } = useToast();
  const { user, can } = useAuth();
  const [jumpQuery, setJumpQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [jumping, setJumping] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(jumpQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [jumpQuery]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const searchEnabled = debouncedQuery.length >= ADMIN_SEARCH_MIN_LENGTH;

  const searchQuery = useQuery({
    queryKey: ['admin-search', debouncedQuery, appConfig.useMockApi],
    enabled: searchEnabled,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return mockAdminSearch(debouncedQuery, can);
      }
      return adminSearch(debouncedQuery, signal);
    },
  });

  const options = useMemo<SearchOption[]>(() => {
    const data = searchQuery.data;
    if (!data) return [];
    const userOptions = data.users.map((row) => ({
      key: `user-${row.id}`,
      label: row.email,
      detail: row.phone || row.id,
      tag: formatStatusLabel(row.status),
      path: `/admin/users/${row.id}`,
    }));
    const userIds = new Set(data.users.map((row) => row.id));
    const matchOptions = data.matches
      .filter((match) => !(match.type === 'USER' && userIds.has(match.id)))
      .map((match) => ({
        key: `match-${match.type}-${match.id}`,
        label: match.label,
        detail: match.id,
        tag: formatStatusLabel(match.type),
        path: match.path,
      }));
    return [...userOptions, ...matchOptions];
  }, [searchQuery.data]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [options]);

  const themeIcon =
    mode === 'light' ? (
      <Sun className="h-4 w-4" />
    ) : mode === 'dark' ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    );

  const displayName = user?.email ?? 'Admin Operator';

  function goTo(path: string) {
    if (!path.startsWith('/admin')) return;
    navigate(path);
    setJumpQuery('');
    setDebouncedQuery('');
    setOpen(false);
  }

  async function onJump(event?: FormEvent) {
    event?.preventDefault();
    const raw = jumpQuery.trim();
    if (!raw) return;

    const highlighted = activeIndex >= 0 ? options[activeIndex] : undefined;
    if (highlighted) {
      goTo(highlighted.path);
      return;
    }

    const resultsCurrent = debouncedQuery === raw && searchQuery.data;
    if (resultsCurrent && options.length > 0) {
      goTo(options[0]!.path);
      return;
    }

    if (UUID_RE.test(raw)) {
      if (!can('users:read')) {
        push({
          tone: 'warning',
          title: 'Permission required',
          description: 'users:read is required to open a user by UUID.',
        });
        return;
      }
      setJumping(true);
      try {
        if (!appConfig.useMockApi) {
          await getAdminUser(raw);
        }
        goTo(`/admin/users/${raw}`);
      } catch (error) {
        push({
          tone: 'error',
          title: 'Not found',
          description:
            error instanceof ApiClientError ? error.message : 'Nothing readable matched that UUID.',
        });
      } finally {
        setJumping(false);
      }
      return;
    }

    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (options.length === 0 ? -1 : (index + 1) % options.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        options.length === 0 ? -1 : (index - 1 + options.length) % options.length,
      );
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showDropdown = open && jumpQuery.trim().length >= ADMIN_SEARCH_MIN_LENGTH;
  const pendingDebounce = jumpQuery.trim() !== debouncedQuery;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-surface shadow-card">
      <div className="flex h-[var(--header-height)] items-center gap-3 px-4 lg:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="ki-head-icon lg:hidden"
          aria-label="Open navigation"
          onClick={toggleMobileNav}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin/dashboard' },
              { label: crumb },
            ]}
          />
        </div>

        <form
          ref={containerRef}
          className="relative min-w-0 max-w-[10.5rem] flex-1 sm:max-w-xs md:max-w-md"
          onSubmit={onJump}
          role="search"
        >
          <label className="relative block">
            <span className="sr-only">Search users, IDs, and records</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={jumpQuery}
              onChange={(event) => {
                setJumpQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              disabled={jumping}
              placeholder="Search email, phone, or UUID…"
              aria-expanded={showDropdown}
              aria-controls="admin-global-search-results"
              aria-autocomplete="list"
              role="combobox"
              className="h-9 w-full rounded-[0.6rem] border border-transparent bg-surface-secondary/60 pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted transition-smooth focus:border-border focus:bg-surface focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {showDropdown ? (
            <div
              id="admin-global-search-results"
              className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-[0.6rem] border border-border bg-surface p-1 shadow-card md:min-w-[22rem]"
            >
              {pendingDebounce || searchQuery.isFetching ? (
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Searching…
                </p>
              ) : searchQuery.isError ? (
                <p className="px-3 py-2 text-xs text-danger">
                  {searchQuery.error instanceof ApiClientError
                    ? searchQuery.error.message
                    : 'Search failed.'}
                </p>
              ) : options.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-muted">No matches you can access.</p>
              ) : (
                <ul role="listbox" aria-label="Search results">
                  {options.map((option, index) => (
                    <li key={option.key} role="option" aria-selected={index === activeIndex}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-secondary',
                          index === activeIndex && 'bg-surface-secondary',
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => goTo(option.path)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-text-primary">
                            {option.label}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-text-muted">
                            {option.detail}
                          </span>
                        </span>
                        <Badge tone="neutral" className="shrink-0">
                          {option.tag}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </form>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="ki-head-icon"
            aria-label={`Theme: ${mode}. Click to cycle.`}
            onClick={cycleMode}
          >
            {themeIcon}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="ki-head-icon"
            aria-label="Notifications"
            onClick={() =>
              push({
                tone: 'info',
                title: 'Notifications',
                description: 'The admin notification center is not available yet.',
              })
            }
          >
            <Bell className="h-4 w-4" />
          </Button>

          <div className="ml-1 hidden items-center gap-2 sm:flex">
            <Avatar name={displayName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{displayName}</p>
              <p className="truncate text-xs text-text-muted">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
