import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { useShell } from '@/app/providers/ShellProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { findNavItem, primaryNav, type NavItem } from '@/config/navigation';
import { cn } from '@/lib/cn';

function pathWithoutHash(path: string) {
  const hashAt = path.indexOf('#');
  return hashAt >= 0 ? path.slice(0, hashAt) : path;
}

function isPathActive(pathname: string, path: string) {
  const base = pathWithoutHash(path);
  return pathname === base || pathname.startsWith(`${base}/`);
}

function NavLeaf({
  item,
  collapsed,
  onNavigate,
  nested,
  activeId,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
  nested?: boolean;
  activeId?: string;
}) {
  const Icon = item.icon;
  const isActive = activeId === item.id;
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'ki-nav-item',
        isActive ? 'ki-nav-item-active' : 'ki-nav-item-inactive',
        collapsed && 'justify-center !px-2',
        nested && !collapsed && 'py-2 pl-9 text-[14px]',
      )}
    >
      <Icon className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden />
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate text-left">{item.label}</span>
          {item.contractPending ? (
            <Badge tone="warning" className="shrink-0">
              Pending
            </Badge>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({
  item,
  items,
  collapsed,
  onNavigate,
  activeId,
}: {
  item: NavItem;
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
  activeId?: string;
}) {
  const location = useLocation();
  const childActive = items.some((child) => isPathActive(location.pathname, child.path));
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (collapsed) {
    const target = items[0]?.path ?? item.path;
    const collapsedActive = items.some((child) => child.id === activeId);
    return (
      <Link
        to={target}
        onClick={onNavigate}
        title={item.label}
        aria-current={collapsedActive ? 'page' : undefined}
        className={cn(
          'ki-nav-item justify-center !px-2',
          collapsedActive ? 'ki-nav-item-active' : 'ki-nav-item-inactive',
        )}
      >
        <Icon className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden />
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="ki-nav-item ki-nav-item-inactive w-full cursor-pointer"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate text-left">{item.label}</span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <ul className="mt-1 flex flex-col gap-1">
          {items.map((child) => (
            <li key={child.id}>
              <NavLeaf
                item={child}
                collapsed={false}
                onNavigate={onNavigate}
                nested
                activeId={activeId}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { can } = useAuth();
  const location = useLocation();
  const activeId = findNavItem(location.pathname, location.hash)?.id;
  const visible = useMemo(
    () =>
      primaryNav
        .map((item) => {
          if (!item.children?.length) return item;
          return {
            ...item,
            children: item.children.filter((child) => can(child.permission)),
          };
        })
        .filter((item) => {
          if (item.permissionsAny?.length) {
            if (!item.permissionsAny.some((code) => can(code))) return false;
          } else if (!can(item.permission)) {
            return false;
          }
          if (item.children) return item.children.length > 0;
          return true;
        }),
    [can],
  );

  return (
    <>
      {!collapsed ? <p className="ki-menu-title">Navigation</p> : null}
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        {visible.map((item) => {
          const items = item.children ?? [];
          return (
            <li key={item.id}>
              {items.length > 0 ? (
                <NavGroup
                  item={item}
                  items={items}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  activeId={activeId}
                />
              ) : (
                <NavLeaf
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  activeId={activeId}
                />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SidebarChrome({
  collapsed,
  onCollapseToggle,
  onCloseMobile,
  mobile,
}: {
  collapsed: boolean;
  onCollapseToggle?: () => void;
  onCloseMobile?: () => void;
  mobile?: boolean;
}) {
  const { logout } = useAuth();
  const { push } = useToast();

  async function onLogout() {
    onCloseMobile?.();
    await logout();
    push({ tone: 'success', title: 'Signed out', description: 'Your admin session was cleared.' });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex h-[var(--header-height)] shrink-0 items-center border-b border-border px-3',
          collapsed && !mobile ? 'justify-center' : 'justify-between gap-2',
        )}
      >
        <div className={cn('flex min-w-0 items-center gap-2.5', collapsed && !mobile && 'justify-center')}>
          <img
            src="/palpeer-logo.png"
            alt="PALPEER"
            className={cn(
              'object-contain',
              collapsed && !mobile ? 'h-8 w-8' : 'h-9 w-auto max-w-[140px]',
            )}
          />
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <p className="truncate text-[11px] text-text-muted">Admin Operations</p>
            </div>
          )}
        </div>
        {mobile ? (
          <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={onCloseMobile}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              collapsed &&
                'absolute -right-3 top-4 z-10 hidden border border-border bg-surface shadow-card lg:inline-flex',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onCollapseToggle}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <NavList collapsed={!mobile && collapsed} onNavigate={onCloseMobile} />

      <div className="mt-auto shrink-0 border-t border-border px-3 py-4">
        <button
          type="button"
          className={cn(
            'ki-nav-item ki-nav-item-inactive w-full cursor-pointer',
            !mobile && collapsed && 'justify-center !px-2',
          )}
          onClick={() => void onLogout()}
        >
          <LogOut className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden />
          {(mobile || !collapsed) && <span className="flex-1 text-left">Logout</span>}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed, mobileNavOpen, setMobileNavOpen } = useShell();

  return (
    <>
      <aside
        className={cn(
          'relative hidden h-screen shrink-0 border-r border-border bg-surface shadow-sidebar transition-[width] duration-300 lg:sticky lg:top-0 lg:block',
          sidebarCollapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
        )}
        aria-label="Primary"
      >
        <SidebarChrome collapsed={sidebarCollapsed} onCollapseToggle={toggleSidebarCollapsed} />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-slate-950/50"
            aria-label="Close navigation overlay"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(100%,20rem)] animate-fade-in border-r border-border bg-surface shadow-sidebar">
            <SidebarChrome collapsed={false} mobile onCloseMobile={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
