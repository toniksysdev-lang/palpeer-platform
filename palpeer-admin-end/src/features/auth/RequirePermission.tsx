import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ErrorState } from '@/components/feedback/ErrorState';

/**
 * Route guard for permission-coded modules. Auth is still enforced by RequireAuth.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission?: string;
  children: ReactNode;
}) {
  const { can, status } = useAuth();

  if (!permission) return children;
  if (status !== 'authenticated') {
    return <Navigate to="/sign-in" replace />;
  }
  if (!can(permission)) {
    return (
      <ErrorState
        title="Permission required"
        description={`This module requires ${permission}. Your session is authenticated but lacks that authority.`}
      />
    );
  }
  return children;
}
