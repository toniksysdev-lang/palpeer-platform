import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Copy, UserCog } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Drawer } from '@/components/dialogs/Drawer';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { copyToClipboard } from '@/lib/clipboard';
import {
  mockCreateAdmin,
  mockDeleteAdmin,
  mockDisableAdmin,
  mockListAdmins,
  mockUpdateAdmin,
} from '@/mocks/admins';
import { mockListRoles } from '@/mocks/rbac';
import {
  createAdmin,
  deleteAdmin,
  disableAdmin,
  listAdmins,
  updateAdmin,
  type CreateAdminResult,
} from '@/services/api/admins';
import { listRoles } from '@/services/api/rbac';
import type { AdminOperator } from '@/types/admin';
import { ApiClientError } from '@/types/api';

const createSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  password: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || value.length >= 8, 'Password must be at least 8 characters.')
    .optional(),
  roleCodes: z.array(z.string().trim().min(1)).min(1, 'Select at least one role.'),
  sendInviteEmail: z.boolean(),
});

const editSchema = z.object({
  roleCodes: z.array(z.string().trim().min(1)).min(1, 'Select at least one role.'),
  enabled: z.boolean(),
  resetPassword: z.boolean(),
});

function RoleChecklist({
  options,
  selected,
  onChange,
  error,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-primary">Roles</p>
      {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(options.length > 0 ? options : [{ value: 'SUPER_ADMIN', label: 'SUPER_ADMIN' }]).map(
          (option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 rounded-[0.6rem] border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((code) => code !== option.value)
                        : [...selected, option.value],
                    )
                  }
                />
                <span className="font-mono text-xs">{option.label}</span>
              </label>
            );
          },
        )}
      </div>
    </div>
  );
}

export function AdminsPage() {
  const { can, user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canManage = can('admin:manage');

  const [emailDraft, setEmailDraft] = useState('');
  const [firstNameDraft, setFirstNameDraft] = useState('');
  const [lastNameDraft, setLastNameDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['SUPER_ADMIN']);
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    roleCodes?: string;
  }>({});
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreateAdminResult | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const [editing, setEditing] = useState<AdminOperator | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editResetPassword, setEditResetPassword] = useState(false);
  const [editErrors, setEditErrors] = useState<{ roleCodes?: string }>({});
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const [disableTarget, setDisableTarget] = useState<AdminOperator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminOperator | null>(null);

  const adminsQuery = useQuery({
    queryKey: ['admin-operators', appConfig.useMockApi],
    enabled: canManage,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        return mockListAdmins();
      }
      return listAdmins();
    },
  });

  const rolesQuery = useQuery({
    queryKey: ['admin-roles', appConfig.useMockApi],
    enabled: canManage,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return mockListRoles();
      }
      return listRoles();
    },
  });

  useEffect(() => {
    if (!editing) return;
    setEditRoles([...editing.roleCodes]);
    setEditEnabled(editing.enabled);
    setEditResetPassword(false);
    setEditErrors({});
  }, [editing]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createSchema.safeParse({
        email: emailDraft,
        firstName: firstNameDraft,
        lastName: lastNameDraft,
        password: passwordDraft,
        roleCodes: selectedRoles,
        sendInviteEmail,
      });
      if (!parsed.success) {
        const next: {
          email?: string;
          firstName?: string;
          lastName?: string;
          password?: string;
          roleCodes?: string;
        } = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (
            key === 'email' ||
            key === 'firstName' ||
            key === 'lastName' ||
            key === 'password' ||
            key === 'roleCodes'
          ) {
            next[key] = issue.message;
          }
        }
        setFormErrors(next);
        throw new Error('validation');
      }
      setFormErrors({});
      const input = {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        password: parsed.data.password || undefined,
        roleCodes: parsed.data.roleCodes,
        sendInviteEmail: parsed.data.sendInviteEmail,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        return mockCreateAdmin(input);
      }
      return createAdmin(input);
    },
    onSuccess: (result) => {
      setCreateConfirmOpen(false);
      setEmailDraft('');
      setFirstNameDraft('');
      setLastNameDraft('');
      setPasswordDraft('');
      setCreatedResult(result);
      setPasswordCopied(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-operators'] });
      push({
        tone: 'success',
        title: 'Admin created',
        description: result.inviteEmailSent
          ? 'Login details were emailed to the new operator.'
          : 'Operator created. Copy the temporary password below — invite email was not sent.',
      });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'validation') return;
      push({
        tone: 'error',
        title: 'Create failed',
        description: error instanceof ApiClientError ? error.message : 'Could not create admin.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('validation');
      const parsed = editSchema.safeParse({
        roleCodes: editRoles,
        enabled: editEnabled,
        resetPassword: editResetPassword,
      });
      if (!parsed.success) {
        const next: { roleCodes?: string } = {};
        for (const issue of parsed.error.issues) {
          if (issue.path[0] === 'roleCodes') next.roleCodes = issue.message;
        }
        setEditErrors(next);
        throw new Error('validation');
      }
      setEditErrors({});
      const input = {
        roleCodes: parsed.data.roleCodes,
        enabled: parsed.data.enabled,
        resetPassword: parsed.data.resetPassword || undefined,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        return mockUpdateAdmin(editing.userId, input);
      }
      return updateAdmin(editing.userId, input);
    },
    onSuccess: () => {
      setSaveConfirmOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-operators'] });
      push({
        tone: 'success',
        title: 'Admin updated',
        description: editResetPassword
          ? 'Roles saved. A new temporary password was emailed when delivery succeeded.'
          : 'Operator roles and status were saved.',
      });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'validation') return;
      push({
        tone: 'error',
        title: 'Update failed',
        description: error instanceof ApiClientError ? error.message : 'Could not update admin.',
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (operator: AdminOperator) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        return mockDisableAdmin(operator.userId);
      }
      return disableAdmin(operator.userId);
    },
    onSuccess: () => {
      setDisableTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-operators'] });
      push({ tone: 'success', title: 'Admin disabled', description: 'Operator access was disabled.' });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Disable failed',
        description: error instanceof ApiClientError ? error.message : 'Could not disable admin.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (operator: AdminOperator) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        mockDeleteAdmin(operator.userId);
        return;
      }
      await deleteAdmin(operator.userId);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-operators'] });
      push({
        tone: 'success',
        title: 'Admin deleted',
        description: 'Admin console access was removed. The underlying user account remains.',
      });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Delete failed',
        description: error instanceof ApiClientError ? error.message : 'Could not delete admin.',
      });
    },
  });

  const columns = useMemo<DataColumn<AdminOperator>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        cell: (row) => {
          const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
          return <span className="text-sm text-text-primary">{name || '—'}</span>;
        },
      },
      {
        id: 'email',
        header: 'Email',
        cell: (row) => <span className="text-sm text-text-primary">{row.email ?? '—'}</span>,
      },
      {
        id: 'userId',
        header: 'User ID',
        cell: (row) => <span className="font-mono text-[11px] text-text-muted">{row.userId}</span>,
      },
      {
        id: 'roles',
        header: 'Roles',
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.roleCodes.map((roleCode) => (
              <Link key={roleCode} to={`/admin/roles/${encodeURIComponent(roleCode)}`}>
                <Badge tone="info">{roleCode}</Badge>
              </Link>
            ))}
          </div>
        ),
      },
      {
        id: 'enabled',
        header: 'Enabled',
        cell: (row) => (
          <Badge tone={row.enabled ? 'success' : 'danger'}>{row.enabled ? 'Yes' : 'No'}</Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => {
          const isSelf = user?.userId === row.userId;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(row)}>
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!row.enabled || isSelf || disableMutation.isPending}
                onClick={() => setDisableTarget(row)}
              >
                Disable
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isSelf || deleteMutation.isPending}
                onClick={() => setDeleteTarget(row)}
              >
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [disableMutation.isPending, deleteMutation.isPending, user?.userId],
  );

  if (!canManage) {
    return (
      <ErrorState
        title="Permission required"
        description="admin:manage is required to list or mutate admin operators."
      />
    );
  }

  const roleOptions = (rolesQuery.data ?? []).map((role) => ({
    value: role.code,
    label: `${role.code} — ${role.name}`,
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Admins</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Create admin console operators, assign roles from the{' '}
              <Link to="/admin/roles" className="text-primary hover:underline">
                Roles
              </Link>{' '}
              catalog (backed by{' '}
              <Link to="/admin/permissions" className="text-primary hover:underline">
                Permissions
              </Link>
              ), and email temporary login details for first sign-in.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Create admin user</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Creates a platform account when needed, grants the selected roles, and emails sign-in
          credentials to the new operator.
        </p>
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="First name"
              autoComplete="off"
              value={firstNameDraft}
              onChange={(event) => setFirstNameDraft(event.target.value)}
              error={formErrors.firstName}
              placeholder="Ada"
            />
            <Input
              label="Last name"
              autoComplete="off"
              value={lastNameDraft}
              onChange={(event) => setLastNameDraft(event.target.value)}
              error={formErrors.lastName}
              placeholder="Lovelace"
            />
          </div>
          <Input
            label="Email"
            type="email"
            autoComplete="off"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            error={formErrors.email}
            placeholder="ops@company.com"
          />
          <Input
            label="Temporary password (optional)"
            type="text"
            autoComplete="new-password"
            value={passwordDraft}
            onChange={(event) => setPasswordDraft(event.target.value)}
            error={formErrors.password}
            placeholder="Leave blank to auto-generate"
          />
          <RoleChecklist
            options={roleOptions}
            selected={selectedRoles}
            onChange={setSelectedRoles}
            error={formErrors.roleCodes}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={sendInviteEmail}
              onChange={(event) => setSendInviteEmail(event.target.checked)}
            />
            Email login details to the new admin
          </label>
          <Button onClick={() => setCreateConfirmOpen(true)} disabled={createMutation.isPending}>
            Create admin
          </Button>
        </div>
      </section>

      {createdResult ? (
        <section className="rounded-[0.6rem] border border-warning/30 bg-warning/10 p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Temporary password (shown once)</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {createdResult.inviteEmailSent
              ? 'Also sent by email. Copy it now in case delivery is delayed.'
              : 'Invite email was not sent. Copy this password and share it securely.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-[0.6rem] border border-border bg-surface px-3 py-2 font-mono text-sm">
              {createdResult.temporaryPassword}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                const ok = await copyToClipboard(createdResult.temporaryPassword);
                if (ok) {
                  setPasswordCopied(true);
                  window.setTimeout(() => setPasswordCopied(false), 2000);
                }
              }}
            >
              {passwordCopied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {passwordCopied ? 'Copied' : 'Copy'}
            </Button>
            <Button type="button" size="sm" onClick={() => setCreatedResult(null)}>
              Dismiss
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        {adminsQuery.isError ? (
          <ErrorState
            description={
              adminsQuery.error instanceof ApiClientError
                ? adminsQuery.error.message
                : 'Failed to load admin operators.'
            }
            onRetry={() => void adminsQuery.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={adminsQuery.data ?? []}
            rowKey={(row) => row.id}
            loading={adminsQuery.isLoading}
            emptyTitle="No admin operators"
            emptyDescription="Create an admin user with name, email, and at least one role."
          />
        )}
      </section>

      <Drawer open={Boolean(editing)} title="Edit admin" onClose={() => setEditing(null)}>
        {editing ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Email</p>
              <p className="mt-1 text-sm text-text-primary">{editing.email ?? '—'}</p>
            </div>
            <RoleChecklist
              options={roleOptions}
              selected={editRoles}
              onChange={setEditRoles}
              error={editErrors.roleCodes}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={editEnabled}
                disabled={user?.userId === editing.userId}
                onChange={(event) => setEditEnabled(event.target.checked)}
              />
              Enabled (can sign in to the admin console)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={editResetPassword}
                onChange={(event) => setEditResetPassword(event.target.checked)}
              />
              Generate a new temporary password and email it
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={() => setSaveConfirmOpen(true)} disabled={updateMutation.isPending}>
                Save changes
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={createConfirmOpen}
        title="Create admin user?"
        description="This creates or promotes the account, assigns roles, and emails login details when enabled."
        confirmLabel="Create"
        tone="primary"
        busy={createMutation.isPending}
        onClose={() => setCreateConfirmOpen(false)}
        onConfirm={() => void createMutation.mutateAsync()}
      />

      <ConfirmDialog
        open={saveConfirmOpen}
        title="Save admin changes?"
        description={
          editResetPassword
            ? 'Roles/status will update and a new temporary password will be emailed when possible.'
            : 'Update roles and enabled status for this operator.'
        }
        confirmLabel="Save"
        tone="primary"
        busy={updateMutation.isPending}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={() => void updateMutation.mutateAsync()}
      />

      <ConfirmDialog
        open={Boolean(disableTarget)}
        title="Disable admin access?"
        description={`Disable ${disableTarget?.email ?? disableTarget?.userId ?? ''}. They will lose admin console access.`}
        confirmLabel="Disable"
        busy={disableMutation.isPending}
        onClose={() => setDisableTarget(null)}
        onConfirm={() => {
          if (disableTarget) void disableMutation.mutateAsync(disableTarget);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete admin operator?"
        description={`Remove admin access for ${deleteTarget?.email ?? deleteTarget?.userId ?? ''}. The underlying user account is kept; MFA enrollment for this operator is cleared.`}
        confirmLabel="Delete"
        busy={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteMutation.mutateAsync(deleteTarget);
        }}
      />
    </div>
  );
}
