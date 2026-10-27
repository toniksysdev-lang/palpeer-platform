import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
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
  beginAdminMfaSetup,
  changePassword,
  disableAdminMfa,
  enableAdminMfa,
  fetchAdminMfaStatus,
  listAuthSessions,
  revokeAllAuthSessions,
  revokeAuthSession,
  type AdminMfaSetup,
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

function MfaEnrollmentCard() {
  const { push } = useToast();
  const { refreshMe, mfaEnrollmentRequired } = useAuth();
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<AdminMfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const statusQuery = useQuery({
    queryKey: ['admin-mfa-status'],
    queryFn: async () => {
      if (appConfig.useMockApi) {
        return { enabled: false, enabledAt: null };
      }
      return fetchAdminMfaStatus();
    },
  });

  const setupMutation = useMutation({
    mutationFn: beginAdminMfaSetup,
    onSuccess: (data) => {
      setSetup(data);
      setCode('');
      push({
        tone: 'info',
        title: 'Authenticator setup started',
        description: 'Scan the otpauth URL or enter the secret in your app, then confirm with a code.',
      });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Could not start MFA setup',
        description: error instanceof ApiClientError ? error.message : 'Try again.',
      });
    },
  });

  const enableMutation = useMutation({
    mutationFn: () => enableAdminMfa(code),
    onSuccess: async (result) => {
      setSetup(null);
      setCode('');
      setRecoveryCodes(result.recoveryCodes?.length ? [...result.recoveryCodes] : null);
      await queryClient.invalidateQueries({ queryKey: ['admin-mfa-status'] });
      try {
        await refreshMe();
      } catch {
        // Session still valid; next navigation will refresh me.
      }
      push({
        tone: 'success',
        title: 'MFA enabled',
        description: 'Save your recovery codes now — they are shown only once.',
      });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Could not enable MFA',
        description: error instanceof ApiClientError ? error.message : 'Check the code and try again.',
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => disableAdminMfa({ password: disablePassword, code: disableCode }),
    onSuccess: async () => {
      setDisablePassword('');
      setDisableCode('');
      setRecoveryCodes(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-mfa-status'] });
      try {
        await refreshMe();
      } catch {
        // ignore
      }
      push({ tone: 'success', title: 'MFA disabled' });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Could not disable MFA',
        description: error instanceof ApiClientError ? error.message : 'Check password and code.',
      });
    },
  });

  const enabled = Boolean(statusQuery.data?.enabled);

  return (
    <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">Authenticator MFA</h3>
        </div>
        <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Enabled' : 'Off'}</Badge>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Require a TOTP code from Google Authenticator, 1Password, or similar after password sign-in.
        {mfaEnrollmentRequired
          ? ' Enrollment is required for this environment before other admin pages unlock.'
          : null}
      </p>

      {recoveryCodes ? (
        <div className="mt-4 rounded-[0.6rem] border border-warning/30 bg-warning/10 p-3 text-sm">
          <p className="font-medium text-text-primary">Recovery codes (save offline — shown once)</p>
          <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
            {recoveryCodes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setRecoveryCodes(null)}>
            I have saved these codes
          </Button>
        </div>
      ) : null}

      {appConfig.useMockApi ? (
        <p className="mt-4 text-sm text-text-muted">MFA enrollment is available in live API mode only.</p>
      ) : enabled ? (
        <form
          className="mt-4 grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            disableMutation.mutate();
          }}
        >
          <Input
            label="Password"
            id="mfa-disable-password"
            type="password"
            autoComplete="current-password"
            value={disablePassword}
            onChange={(event) => setDisablePassword(event.target.value)}
          />
          <Input
            label="Current code"
            id="mfa-disable-code"
            autoComplete="one-time-code"
            value={disableCode}
            onChange={(event) =>
              setDisableCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))
            }
          />
          <div className="flex items-end">
            <Button type="submit" variant="secondary" disabled={disableMutation.isPending}>
              Disable MFA
            </Button>
          </div>
          <p className="md:col-span-3 text-xs text-text-muted">
            {statusQuery.data?.recoveryCodesRemaining != null
              ? `${statusQuery.data.recoveryCodesRemaining} recovery code(s) remaining.`
              : null}
          </p>
        </form>
      ) : setup ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[0.6rem] border border-border bg-surface-secondary/50 p-3 text-sm">
            <p className="font-medium text-text-primary">Secret</p>
            <code className="mt-1 block break-all font-mono text-xs text-text-secondary">{setup.secret}</code>
            <p className="mt-3 font-medium text-text-primary">otpauth URL</p>
            <code className="mt-1 block break-all font-mono text-xs text-text-secondary">{setup.otpauthUrl}</code>
          </div>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              enableMutation.mutate();
            }}
          >
            <Input
              label="Confirm code"
              id="mfa-enable-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button type="submit" disabled={enableMutation.isPending}>
              Enable MFA
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSetup(null);
                setCode('');
              }}
            >
              Cancel
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            type="button"
            disabled={setupMutation.isPending || statusQuery.isLoading}
            onClick={() => setupMutation.mutate()}
          >
            Set up authenticator
          </Button>
        </div>
      )}
    </section>
  );
}

export function SecuritySettings() {
  return (
    <div id="security" className="scroll-mt-24 space-y-5">
      <ChangePasswordCard />
      <ActiveSessionsCard />
      <MfaEnrollmentCard />
    </div>
  );
}
