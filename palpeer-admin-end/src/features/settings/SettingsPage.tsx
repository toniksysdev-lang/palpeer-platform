import { Link } from 'react-router-dom';
import { Monitor, Moon, Settings, Sun, UserRound } from 'lucide-react';
import { useTheme } from '@/app/providers/ThemeProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { SecuritySettings } from '@/features/settings/SecuritySettings';
import type { ThemeMode } from '@/lib/theme';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsPage() {
  const { user, permissions, roles, can } = useAuth();
  const { mode, setMode, resolved } = useTheme();
  const canManage = can('admin:manage');

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Profile, preferences, password, and active sessions. Operator access is managed under
              Admins, Roles, and Permissions. Two-factor authentication is not available yet.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">Admin profile</h3>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Email</dt>
            <dd className="mt-1 text-sm text-text-primary">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">User ID</dt>
            <dd className="mt-1 font-mono text-xs text-text-primary">{user?.userId ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Roles</dt>
            <dd className="mt-1 text-sm text-text-secondary">
              {roles.length === 0 ? (
                <span>—</span>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {roles.map((code) => (
                    <Badge key={code} tone="primary">
                      {code}
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Permissions
            </dt>
            <dd className="mt-1 text-sm text-text-secondary">
              {permissions === 'unknown' ? (
                <span>Permission list unavailable for this session.</span>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {permissions.map((code) => (
                    <Badge key={code} tone="info">
                      {code}
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Appearance</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Theme preference is stored locally on this device. Resolved mode: {resolved}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.value;
            return (
              <Button
                key={option.value}
                variant={active ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={active}
                onClick={() => setMode(option.value)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </Button>
            );
          })}
        </div>
      </section>

      {canManage ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Access control</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Manage operators, roles, and the permission catalog from dedicated modules.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/admins"
              className="rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
            >
              Admins
            </Link>
            <Link
              to="/admin/roles"
              className="rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
            >
              Roles
            </Link>
            <Link
              to="/admin/permissions"
              className="rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
            >
              Permissions
            </Link>
          </div>
        </section>
      ) : null}

      <SecuritySettings />
    </div>
  );
}
