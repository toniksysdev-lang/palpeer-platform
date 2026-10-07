import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UserCog } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { mockAssignAdmin, mockDisableAdmin, mockListAdmins } from '@/mocks/admins';
import { mockListRoles } from '@/mocks/rbac';
import { assignAdmin, disableAdmin, listAdmins } from '@/services/api/admins';
import { listRoles } from '@/services/api/rbac';
import type { AdminOperator } from '@/types/admin';
import { ApiClientError } from '@/types/api';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assignSchema = z.object({
  userId: z.string().trim().regex(UUID_RE, 'Enter a valid user UUID.'),
  roleCodes: z.array(z.string().trim().min(1)).min(1, 'Select at least one role.'),
});

export function AdminsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canManage = can('admin:manage');

  const [userIdDraft, setUserIdDraft] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['SUPER_ADMIN']);
  const [formErrors, setFormErrors] = useState<{ userId?: string; roleCodes?: string }>({});
  const [disableTarget, setDisableTarget] = useState<AdminOperator | null>(null);
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);

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

  const assignMutation = useMutation({
    mutationFn: async () => {
      const parsed = assignSchema.safeParse({ userId: userIdDraft, roleCodes: selectedRoles });
      if (!parsed.success) {
        const next: { userId?: string; roleCodes?: string } = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (key === 'userId' || key === 'roleCodes') next[key] = issue.message;
        }
        setFormErrors(next);
        throw new Error('validation');
      }
      setFormErrors({});
      const input = { userId: parsed.data.userId, roleCodes: parsed.data.roleCodes };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        return mockAssignAdmin(input);
      }
      return assignAdmin(input);
    },
    onSuccess: () => {
      setAssignConfirmOpen(false);
      setUserIdDraft('');
      void queryClient.invalidateQueries({ queryKey: ['admin-operators'] });
      push({ tone: 'success', title: 'Admin assigned', description: 'Operator roles were updated.' });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'validation') return;
      push({
        tone: 'error',
        title: 'Assign failed',
        description: error instanceof ApiClientError ? error.message : 'Could not assign admin.',
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

  const columns = useMemo<DataColumn<AdminOperator>[]>(
    () => [
      {
        id: 'userId',
        header: 'User ID',
        cell: (row) => <span className="font-mono text-[11px]">{row.userId}</span>,
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
        cell: (row) => (
          <Button
            variant="danger"
            size="sm"
            disabled={!row.enabled || disableMutation.isPending}
            onClick={() => setDisableTarget(row)}
          >
            Disable
          </Button>
        ),
      },
    ],
    [disableMutation.isPending],
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
              Assign platform users as admin operators with one or more roles. Manage the role
              catalog under{' '}
              <Link to="/admin/roles" className="text-primary hover:underline">
                Roles
              </Link>{' '}
              and{' '}
              <Link to="/admin/permissions" className="text-primary hover:underline">
                Permissions
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Assign operator</h3>
        <div className="mt-4 space-y-4">
          <Input
            label="User ID (UUID)"
            value={userIdDraft}
            onChange={(event) => setUserIdDraft(event.target.value)}
            error={formErrors.userId}
            placeholder="00000000-0000-4000-8000-000000000001"
          />
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Roles</p>
            {formErrors.roleCodes ? (
              <p className="mb-2 text-xs text-danger">{formErrors.roleCodes}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(roleOptions.length > 0
                ? roleOptions
                : [{ value: 'SUPER_ADMIN', label: 'SUPER_ADMIN' }]
              ).map((option) => {
                const checked = selectedRoles.includes(option.value);
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
                        setSelectedRoles((current) =>
                          checked
                            ? current.filter((code) => code !== option.value)
                            : [...current, option.value],
                        )
                      }
                    />
                    <span className="font-mono text-xs">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <Button onClick={() => setAssignConfirmOpen(true)} disabled={assignMutation.isPending}>
            Assign admin
          </Button>
        </div>
      </section>

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
            emptyDescription="Assign an existing platform user UUID with a known role."
          />
        )}
      </section>

      <ConfirmDialog
        open={assignConfirmOpen}
        title="Assign admin roles?"
        description="This grants admin console roles to the selected user."
        confirmLabel="Assign"
        tone="primary"
        busy={assignMutation.isPending}
        onClose={() => setAssignConfirmOpen(false)}
        onConfirm={() => void assignMutation.mutateAsync()}
      />

      <ConfirmDialog
        open={Boolean(disableTarget)}
        title="Disable admin access?"
        description={`Disable operator ${disableTarget?.userId ?? ''}. They will lose admin console access.`}
        confirmLabel="Disable"
        busy={disableMutation.isPending}
        onClose={() => setDisableTarget(null)}
        onConfirm={() => {
          if (disableTarget) void disableMutation.mutateAsync(disableTarget);
        }}
      />
    </div>
  );
}
