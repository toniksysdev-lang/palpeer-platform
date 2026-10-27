import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { Skeleton } from '@/components/ui/Skeleton';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, isAdmin, mfaEnrollmentRequired } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-3 rounded-[0.6rem] border border-border bg-surface p-6 shadow-card">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <p className="pt-2 text-xs text-text-muted">Restoring admin session…</p>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated' || !isAdmin) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  const onSecuritySettings =
    location.pathname === '/admin/settings' || location.pathname.startsWith('/admin/settings/');
  if (mfaEnrollmentRequired && !onSecuritySettings) {
    return <Navigate to="/admin/settings#security" replace />;
  }

  return children;
}
