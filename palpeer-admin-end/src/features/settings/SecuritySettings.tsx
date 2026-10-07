import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound, MonitorSmartphone } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ContractPendingState } from '@/components/feedback/ContractPendingState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { getRefreshToken } from '@/features/auth/session';
import { formatDateTime } from '@/lib/format';
import {
  mockChangePassword,
  mockListSessions,
  mockRevokeAllSessions,
  mockRevokeSession,
} from '@/mocks/auth';
import {
  changePassword,
  listAuthSessions,
  revokeAllAuthSessions,
  revokeAuthSession,
  type AuthSession,
} from '@/services/api/auth';
import { ApiClientError } from '@/types/api';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current password.',
  });

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

function ChangePasswordCard() {
  const { logout } = useAuth();
  const { push } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({});

  const mutation = useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        mockChangePassword(input);
        return;
      }
      await changePassword(input);
    },
    onSuccess: async () => {
      push({
        tone: 'success',
        title: 'Password changed',
        description: 'All sessions were revoked. Sign in again with your new password.',
      });
      await logout();
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Password change failed',
        description: error instanceof ApiClientError ? error.message : 'Could not change password.',
      });
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      const next: Partial<Record<PasswordField, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as PasswordField | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    mutation.mutate({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  }

  return (
    <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-base font-semibold text-text-primary">Change password</h3>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Uses the same password rules as registration. Changing your password signs out every
        session, including this one.
      </p>
      <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={onSubmit} noValidate>
        <Input
          label="Current password"
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          error={errors.currentPassword}
        />
        <Input
          label="New password"
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={errors.newPassword}
        />
        <Input
          label="Confirm new password"
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
        />
        <div className="md:col-span-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ActiveSessionsCard() {
  const { logout } = useAuth();
  const { push } = useToast();
  const [revokeTarget, setRevokeTarget] = useState<AuthSession | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ['auth-sessions', appConfig.useMockApi],
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockListSessions();
      }
      return listAuthSessions(getRefreshToken());
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (session: AuthSession) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        mockRevokeSession(session.id);
      } else {
        await revokeAuthSession(session.id);
      }
      return session;
    },
    onSuccess: async (session) => {
      setRevokeTarget(null);
      if (session.current) {
        push({ tone: 'success', title: 'Session revoked', description: 'This device was signed out.' });
        await logout();
        return;
      }
      push({ tone: 'success', title: 'Session revoked', description: 'That session can no longer refresh.' });
      await sessionsQuery.refetch();
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Revoke failed',
        description: error instanceof ApiClientError ? error.message : 'Could not revoke the session.',
      });
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        mockRevokeAllSessions();
        return;
      }
      await revokeAllAuthSessions();
    },
    onSuccess: async () => {
      setRevokeAllOpen(false);
      push({
        tone: 'success',
        title: 'Signed out everywhere',
        description: 'All sessions were revoked. Sign in again to continue.',
      });
      await logout();
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Sign out failed',
        description: error instanceof ApiClientError ? error.message : 'Could not revoke sessions.',
      });
    },
  });

  const columns = useMemo<DataColumn<AuthSession>[]>(
    () => [
      {
        id: 'session',
        header: 'Session',
        cell: (row) => (
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px]">{row.id}</span>
            {row.current ? <Badge tone="success">This device</Badge> : null}
          </span>
        ),
      },
      { id: 'createdAt', header: 'Signed in', cell: (row) => formatDateTime(row.createdAt) },
      { id: 'expiresAt', header: 'Expires', cell: (row) => formatDateTime(row.expiresAt) },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => (
          <Button variant="secondary" size="sm" onClick={() => setRevokeTarget(row)}>
            Revoke
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="text-base font-semibold text-text-primary">Active sessions</h3>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Refresh-token sessions for your account that are not revoked or expired.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          disabled={revokeAllMutation.isPending}
          onClick={() => setRevokeAllOpen(true)}
        >
          Sign out all sessions
        </Button>
      </div>
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={sessionsQuery.data ?? []}
          rowKey={(row) => row.id}
          loading={sessionsQuery.isLoading}
          error={
            sessionsQuery.error instanceof ApiClientError
              ? sessionsQuery.error.message
              : sessionsQuery.error
                ? 'Failed to load sessions.'
                : null
          }
          onRetry={() => void sessionsQuery.refetch()}
          emptyTitle="No active sessions"
          emptyDescription="No refresh-token sessions are active for your account."
        />
      </div>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke session"
        description={
          revokeTarget?.current
            ? 'This is the session you are using now. Revoking it signs you out immediately.'
            : 'The selected session will no longer be able to refresh its access token.'
        }
        confirmLabel="Revoke session"
        busy={revokeMutation.isPending}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revokeMutation.mutate(revokeTarget)}
      />

      <ConfirmDialog
        open={revokeAllOpen}
        title="Sign out all sessions"
        description="Every session for your account, including this one, will be revoked. You will need to sign in again."
        confirmLabel="Sign out everywhere"
        busy={revokeAllMutation.isPending}
        onClose={() => setRevokeAllOpen(false)}
        onConfirm={() => revokeAllMutation.mutate()}
      />
    </section>
  );
}

export function SecuritySettings() {
  return (
    <div id="security" className="scroll-mt-24 space-y-5">
      <ChangePasswordCard />
      <ActiveSessionsCard />
      <ContractPendingState
        title="MFA enrollment"
        description="Multi-factor authentication and recovery codes for admins are not available yet."
        className="p-4"
      />
    </div>
  );
}
