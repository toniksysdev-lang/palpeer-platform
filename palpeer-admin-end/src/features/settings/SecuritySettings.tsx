import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Download, KeyRound, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { formatTotpSecret, TotpQrCode } from '@/components/security/TotpQrCode';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { getRefreshToken } from '@/features/auth/session';
import { copyToClipboard } from '@/lib/clipboard';
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

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function MfaEnrollmentCard() {
  const { push } = useToast();
  const { refreshMe, mfaEnrollmentRequired, user } = useAuth();
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<AdminMfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);

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
      setCodeError(undefined);
      setSecretCopied(false);
      setShowManualKey(false);
      push({
        tone: 'info',
        title: 'Scan with Google Authenticator',
        description: 'Open the app, add an account, scan the QR code, then enter the 6-digit code here.',
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
    mutationFn: (totpCode: string) => enableAdminMfa(totpCode),
    onSuccess: async (result) => {
      setSetup(null);
      setCode('');
      setCodeError(undefined);
      setRecoveryCodes(result.recoveryCodes?.length ? [...result.recoveryCodes] : null);
      await queryClient.invalidateQueries({ queryKey: ['admin-mfa-status'] });
      try {
        await refreshMe();
      } catch {
        // Session still valid; next navigation will refresh me.
      }
      push({
        tone: 'success',
        title: 'Google Authenticator enabled',
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
  const formattedSecret = setup ? formatTotpSecret(setup.secret) : '';

  async function copySecret() {
    if (!setup) return;
    const ok = await copyToClipboard(setup.secret.replace(/\s+/g, ''));
    if (!ok) {
      push({ tone: 'error', title: 'Copy failed', description: 'Select the key and copy it manually.' });
      return;
    }
    setSecretCopied(true);
    window.setTimeout(() => setSecretCopied(false), 2000);
  }

  async function copyRecoveryCodes() {
    if (!recoveryCodes?.length) return;
    const ok = await copyToClipboard(recoveryCodes.join('\n'));
    push(
      ok
        ? { tone: 'success', title: 'Recovery codes copied' }
        : { tone: 'error', title: 'Copy failed', description: 'Download the file instead.' },
    );
  }

  function downloadRecoveryCodes() {
    if (!recoveryCodes?.length) return;
    const email = user?.email ?? 'admin';
    const body = [
      'Palpeer Admin — MFA recovery codes',
      `Account: ${email}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'Store these offline. Each code works once.',
      '',
      ...recoveryCodes,
      '',
    ].join('\n');
    downloadTextFile('palpeer-admin-mfa-recovery-codes.txt', body);
  }

  function onConfirmSetup(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setCodeError('Enter the 6-digit code from Google Authenticator.');
      return;
    }
    setCodeError(undefined);
    enableMutation.mutate(trimmed);
  }

  function cancelSetup() {
    setSetup(null);
    setCode('');
    setCodeError(undefined);
    setSecretCopied(false);
    setShowManualKey(false);
  }

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
        Protect admin sign-in with a time-based code from{' '}
        <span className="font-medium text-text-primary">Google Authenticator</span> (or any TOTP app
        such as 1Password or Authy). Codes refresh every 30 seconds.
        {mfaEnrollmentRequired
          ? ' Enrollment is required for this environment before other admin pages unlock.'
          : null}
      </p>

      {recoveryCodes ? (
        <div className="mt-4 rounded-[0.6rem] border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-text-primary">Recovery codes (shown once)</p>
          <p className="mt-1 text-text-secondary">
            Store these offline. Use one if you lose access to Google Authenticator — each code
            works a single time.
          </p>
          <ul className="mt-3 grid gap-1 font-mono text-xs sm:grid-cols-2">
            {recoveryCodes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyRecoveryCodes()}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={downloadRecoveryCodes}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download
            </Button>
            <Button type="button" size="sm" onClick={() => setRecoveryCodes(null)}>
              I have saved these codes
            </Button>
          </div>
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
            label="Authenticator or recovery code"
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
        <div className="mt-4 space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
            <li>Open Google Authenticator on your phone.</li>
            <li>Tap + → Scan a QR code.</li>
            <li>Confirm with the 6-digit code shown for Palpeer Admin.</li>
          </ol>

          <div className="flex flex-col gap-4 rounded-[0.6rem] border border-border bg-surface-secondary/40 p-4 sm:flex-row sm:items-start">
            <div className="mx-auto shrink-0 sm:mx-0">
              <TotpQrCode otpauthUrl={setup.otpauthUrl} size={200} />
            </div>
            <div className="min-w-0 flex-1 space-y-3 text-sm">
              <p className="font-medium text-text-primary">Can&apos;t scan the code?</p>
              <p className="text-text-secondary">
                In Google Authenticator choose <span className="font-medium">Enter a setup key</span>,
                account name <span className="font-mono text-xs">{user?.email ?? 'your email'}</span>,
                and paste the key below (time-based).
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowManualKey((open) => !open)}
              >
                {showManualKey ? 'Hide setup key' : 'Show setup key'}
              </Button>
              {showManualKey ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="block flex-1 break-all rounded-[0.6rem] border border-border bg-surface px-3 py-2 font-mono text-xs tracking-wider text-text-primary">
                      {formattedSecret}
                    </code>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void copySecret()}>
                      {secretCopied ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {secretCopied ? 'Copied' : 'Copy key'}
                    </Button>
                  </div>
                  <p className="text-xs text-text-muted">
                    Keep this key private. Anyone with it can generate codes for your account.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <form className="flex flex-wrap items-end gap-3" onSubmit={onConfirmSetup} noValidate>
            <Input
              label="6-digit code from the app"
              id="mfa-enable-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              error={codeError}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                setCodeError(undefined);
              }}
            />
            <Button type="submit" disabled={enableMutation.isPending || code.length !== 6}>
              {enableMutation.isPending ? 'Verifying…' : 'Enable MFA'}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelSetup}>
              Cancel
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-text-secondary">
            You will scan a QR code with Google Authenticator, then confirm with a one-time code.
            Recovery codes are issued after enrollment succeeds.
          </p>
          <Button
            type="button"
            disabled={setupMutation.isPending || statusQuery.isLoading}
            onClick={() => setupMutation.mutate()}
          >
            {setupMutation.isPending ? 'Preparing…' : 'Set up Google Authenticator'}
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
