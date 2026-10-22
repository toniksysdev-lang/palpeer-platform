import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ErrorState } from '@/components/feedback/ErrorState';

/**
 * Route guard for permission-coded modules. Auth is still enforced by RequireAuth.
 */
export function RequirePermission({
  permission,
  anyOf,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
}) {
  const { can, status } = useAuth();

  const required = anyOf?.length ? anyOf : permission ? [permission] : [];
  if (required.length === 0) return children;
  if (status !== 'authenticated') {
    return <Navigate to="/sign-in" replace />;
  }
  if (!required.some((code) => can(code))) {
    const label = required.join(' or ');
    return (
      <ErrorState
        title="Permission required"
        description={`This module requires ${label}. Your session is authenticated but lacks that authority.`}
      />
    );
  }
  return children;
}
