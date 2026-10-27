import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { Skeleton } from '@/components/ui/Skeleton';

/** MFA enrollment UI is on Settings → Security (`SecuritySettings`). */
const MFA_ENROLLMENT_PATH = '/admin/settings';
const MFA_ENROLLMENT_HASH = '#security';

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

  const onMfaEnrollmentPage =
    location.pathname === MFA_ENROLLMENT_PATH ||
    location.pathname.startsWith(`${MFA_ENROLLMENT_PATH}/`);
  if (mfaEnrollmentRequired && !onMfaEnrollmentPage) {
    return <Navigate to={`${MFA_ENROLLMENT_PATH}${MFA_ENROLLMENT_HASH}`} replace />;
  }

  return children;
}
