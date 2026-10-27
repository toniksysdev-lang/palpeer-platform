import { Link } from 'react-router-dom';
import { Shield, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth/AuthProvider';

export function AdminProfilePage() {
  const { user, permissions, roles, can } = useAuth();
  const canManage = can('admin:manage');

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Admin user profile</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Your operator account, roles, and permissions. Password, sessions, and authenticator
              MFA are under Settings → Security.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/settings#security"
              className="inline-flex items-center gap-2 rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
            >
              <Shield className="h-4 w-4" aria-hidden />
              Security &amp; MFA
            </Link>
            <Link
              to="/admin/settings"
              className="rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
            >
              Open settings
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-base font-semibold text-text-primary">Admin profile</h2>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Email</dt>
            <dd className="mt-1 text-sm text-text-primary">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">User ID</dt>
            <dd className="mt-1 break-all font-mono text-xs text-text-primary">
              {user?.userId ?? '—'}
            </dd>
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
        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <p className="w-full text-sm text-text-secondary">
              Manage other operators from the RBAC modules.
            </p>
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
        ) : null}
      </section>
    </div>
  );
}
