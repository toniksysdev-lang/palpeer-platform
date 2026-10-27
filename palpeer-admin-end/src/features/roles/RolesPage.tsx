import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Drawer } from '@/components/dialogs/Drawer';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { PermissionActionMatrix } from '@/components/rbac/PermissionActionMatrix';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { catalogActionByCode } from '@/lib/permissionCatalog';
import { formatDateTime } from '@/lib/format';
import {
  createRole,
  getRole,
  listPermissions,
  listRoles,
  updateRole,
} from '@/services/api/rbac';
import type { AdminRole } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import {
  mockCreateRole,
  mockGetRole,
  mockListPermissions,
  mockListRoles,
  mockUpdateRole,
} from '@/mocks/rbac';

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Use UPPER_SNAKE_CASE.'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(255).optional(),
  permissionCodes: z.array(z.string()).min(1, 'Select at least one permission.'),
});

export function RolesPage() {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const allowed = can('admin:manage');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ['admin-roles', appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockListRoles();
      }
      return listRoles();
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ['admin-permissions', appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return mockListPermissions();
      }
      return listPermissions();
    },
  });

  useEffect(() => {
    if (!editing) return;
    setEditName(editing.name);
    setEditDescription(editing.description ?? '');
    setEditPermissions([...editing.permissionCodes]);
  }, [editing]);

  const roleDetailQuery = useQuery({
    queryKey: ['admin-role', routeCode, appConfig.useMockApi],
    enabled: allowed && Boolean(routeCode),
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return mockGetRole(routeCode!);
      }
      return getRole(routeCode!);
    },
  });

  useEffect(() => {
    if (!routeCode) return;
    if (roleDetailQuery.data) {
      setEditing(roleDetailQuery.data);
    }
  }, [routeCode, roleDetailQuery.data]);

  function openEdit(role: AdminRole) {
    setEditing(role);
    if (routeCode !== role.code) {
      void navigate(`/admin/roles/${encodeURIComponent(role.code)}`, { replace: false });
    }
  }

  function closeEdit() {
    setEditing(null);
    if (routeCode) {
      void navigate('/admin/roles', { replace: true });
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createSchema.safeParse({
        code,
        name,
        description: description || undefined,
        permissionCodes: selectedPermissions,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          next[String(issue.path[0])] = issue.message;
        }
        setErrors(next);
        throw new Error('validation');
      }
      setErrors({});
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockCreateRole(parsed.data);
      }
      return createRole(parsed.data);
    },
    onSuccess: (created) => {
      setConfirmOpen(false);
      setCode('');
      setName('');
      setDescription('');
      setSelectedPermissions([]);
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      push({
        tone: 'success',
        title: 'Role created',
        description: `${created.code} is ready to assign to operators.`,
      });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'validation') return;
      push({
        tone: 'error',
        title: 'Create failed',
        description: error instanceof ApiClientError ? error.message : 'Could not create role.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('missing role');
      const input = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        permissionCodes: editPermissions,
      };
      if (!input.name) {
        throw new ApiClientError(400, 'VALIDATION_ERROR', 'Name is required.');
      }
      if (input.permissionCodes.length === 0) {
        throw new ApiClientError(400, 'VALIDATION_ERROR', 'Select at least one permission.');
      }
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockUpdateRole(editing.code, input);
      }
      return updateRole(editing.code, input);
    },
    onSuccess: (updated) => {
      setSaveConfirmOpen(false);
      closeEdit();
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      push({
        tone: 'success',
        title: 'Role updated',
        description: `${updated.code} permissions were saved.`,
      });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Update failed',
        description: error instanceof ApiClientError ? error.message : 'Could not update role.',
      });
    },
  });

  const columns = useMemo<DataColumn<AdminRole>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
      },
      {
        id: 'name',
        header: 'Name',
        cell: (row) => <span className="text-sm font-medium text-text-primary">{row.name}</span>,
      },
      {
        id: 'permissions',
        header: 'Permissions',
        cell: (row) => (
          <div className="flex max-w-md flex-wrap gap-1">
            {row.permissionCodes.slice(0, 6).map((permission) => (
              <Badge key={permission} tone="info">
                {catalogActionByCode(permission)?.label ?? permission}
              </Badge>
            ))}
            {row.permissionCodes.length > 6 ? (
              <Badge tone="neutral">+{row.permissionCodes.length - 6}</Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: (row) => (
          <span className="text-xs text-text-muted">
            {row.createdAt ? formatDateTime(row.createdAt) : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => (
          <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  function togglePermission(codeValue: string, target: 'create' | 'edit') {
    if (target === 'create') {
      setSelectedPermissions((current) =>
        current.includes(codeValue)
          ? current.filter((item) => item !== codeValue)
          : [...current, codeValue],
      );
      return;
    }
    setEditPermissions((current) =>
      current.includes(codeValue)
        ? current.filter((item) => item !== codeValue)
        : [...current, codeValue],
    );
  }

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="admin:manage is required to view or edit roles."
      />
    );
  }

  const catalog = permissionsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Roles</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Define admin roles and attach module permission actions (Read, Edit, Delete, and other)
              from the{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => void navigate('/admin/permissions')}
              >
                Permissions
              </button>{' '}
              catalog. Assign roles from Admins.{' '}
              <code className="font-mono text-xs">SUPER_ADMIN</code> must retain{' '}
              <code className="font-mono text-xs">admin:manage</code>.
            </p>
          </div>
        </div>
      </section>

      {routeCode && roleDetailQuery.isError ? (
        <ErrorState
          title="Role not found"
          description={
            roleDetailQuery.error instanceof ApiClientError
              ? roleDetailQuery.error.message
              : `No role with code ${routeCode}.`
          }
          onRetry={() => void navigate('/admin/roles')}
        />
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Create role</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            label="Code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            error={errors.code}
            placeholder="OPS_ADMIN"
          />
          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            placeholder="Operations Admin"
          />
          <Input
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={errors.description}
            placeholder="Optional"
          />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-text-primary">Permission actions</p>
          {errors.permissionCodes ? (
            <p className="mb-2 text-xs text-danger">{errors.permissionCodes}</p>
          ) : null}
          <PermissionActionMatrix
            mode="select"
            existingCodes={catalog.map((permission) => permission.code)}
            selectedCodes={selectedPermissions}
            onToggle={(code) => togglePermission(code, 'create')}
            disabled={permissionsQuery.isLoading}
          />
        </div>
        <div className="mt-4">
          <Button onClick={() => setConfirmOpen(true)} disabled={createMutation.isPending}>
            Create role
          </Button>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        {rolesQuery.isError ? (
          <ErrorState
            description={
              rolesQuery.error instanceof ApiClientError
                ? rolesQuery.error.message
                : 'Failed to load roles.'
            }
            onRetry={() => void rolesQuery.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rolesQuery.data ?? []}
            rowKey={(row) => row.id}
            loading={rolesQuery.isLoading}
            emptyTitle="No roles"
            emptyDescription="Create a role and assign permissions from the catalog."
          />
        )}
      </section>

      <Drawer
        open={Boolean(editing)}
        title={editing ? `Edit ${editing.code}` : 'Edit role'}
        onClose={closeEdit}
      >
        {editing ? (
          <div className="space-y-4">
            <Input
              label="Name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
            <Input
              label="Description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">Permission actions</p>
              <div className="max-h-[28rem] overflow-y-auto pr-1">
                <PermissionActionMatrix
                  mode="select"
                  existingCodes={catalog.map((permission) => permission.code)}
                  selectedCodes={editPermissions}
                  onToggle={(code) => togglePermission(code, 'edit')}
                />
              </div>
            </div>
            <Button onClick={() => setSaveConfirmOpen(true)} disabled={updateMutation.isPending}>
              Save changes
            </Button>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Create role?"
        description={`Create ${code || 'this role'} with ${selectedPermissions.length} permission action(s).`}
        confirmLabel="Create"
        tone="primary"
        busy={createMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void createMutation.mutateAsync()}
      />

      <ConfirmDialog
        open={saveConfirmOpen}
        title="Save role changes?"
        description={`Update ${editing?.code ?? 'role'} permissions. Operators with this role inherit the new set on next request.`}
        confirmLabel="Save"
        tone="primary"
        busy={updateMutation.isPending}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={() => void updateMutation.mutateAsync()}
      />
    </div>
  );
}
