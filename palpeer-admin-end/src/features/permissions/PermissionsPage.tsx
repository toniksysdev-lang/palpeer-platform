import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { mockCreatePermission, mockListPermissions } from '@/mocks/rbac';
import { createPermission, listPermissions } from '@/services/api/rbac';
import type { AdminPermission } from '@/types/admin';
import { ApiClientError } from '@/types/api';

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/, 'Use resource:action (lowercase).'),
  description: z.string().trim().max(255).optional(),
});

export function PermissionsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const allowed = can('admin:manage');

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ code?: string; description?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ['admin-permissions', appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockListPermissions();
      }
      return listPermissions();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createSchema.safeParse({
        code,
        description: description || undefined,
      });
      if (!parsed.success) {
        const next: { code?: string; description?: string } = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (key === 'code' || key === 'description') next[key] = issue.message;
        }
        setErrors(next);
        throw new Error('validation');
      }
      setErrors({});
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockCreatePermission(parsed.data);
      }
      return createPermission(parsed.data);
    },
    onSuccess: (created) => {
      setConfirmOpen(false);
      setCode('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['admin-permissions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      push({
        tone: 'success',
        title: 'Permission created',
        description: `${created.code} is now available for role assignment.`,
      });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'validation') return;
      push({
        tone: 'error',
        title: 'Create failed',
        description: error instanceof ApiClientError ? error.message : 'Could not create permission.',
      });
    },
  });

  const columns = useMemo<DataColumn<AdminPermission>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        cell: (row) => <span className="font-mono text-xs text-text-primary">{row.code}</span>,
      },
      {
        id: 'description',
        header: 'Description',
        cell: (row) => (
          <span className="text-sm text-text-secondary">{row.description || '—'}</span>
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
    ],
    [],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="admin:manage is required to view or create permissions."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Permissions</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Platform permission catalog used by admin roles. Codes follow{' '}
              <code className="font-mono text-xs">resource:action</code>.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Create permission</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            label="Code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={errors.code}
            placeholder="reports:read"
          />
          <Input
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={errors.description}
            placeholder="Optional description"
          />
          <div className="flex items-end">
            <Button onClick={() => setConfirmOpen(true)} disabled={createMutation.isPending}>
              Create
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        {listQuery.isError ? (
          <ErrorState
            description={
              listQuery.error instanceof ApiClientError
                ? listQuery.error.message
                : 'Failed to load permissions.'
            }
            onRetry={() => void listQuery.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={listQuery.data ?? []}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyTitle="No permissions"
            emptyDescription="Create a permission code to attach it to roles."
          />
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Create permission?"
        description={`Add ${code || 'this permission'} to the catalog. Existing roles are unchanged until you assign it.`}
        confirmLabel="Create"
        tone="primary"
        busy={createMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void createMutation.mutateAsync()}
      />
    </div>
  );
}
