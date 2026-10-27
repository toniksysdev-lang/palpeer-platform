import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PermissionActionMatrix } from '@/components/rbac/PermissionActionMatrix';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import {
  CATALOG_PERMISSION_CODES,
  catalogDescription,
  type CatalogAction,
} from '@/lib/permissionCatalog';
import { mockCreatePermission, mockListPermissions } from '@/mocks/rbac';
import { createPermission, listPermissions } from '@/services/api/rbac';
import type { AdminPermission } from '@/types/admin';
import { ApiClientError } from '@/types/api';

export function PermissionsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const allowed = can('admin:manage');

  const [ensuringCode, setEnsuringCode] = useState<string | null>(null);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

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

  const existingCodes = useMemo(
    () => new Set((listQuery.data ?? []).map((row) => row.code)),
    [listQuery.data],
  );

  const missingCodes = useMemo(
    () => CATALOG_PERMISSION_CODES.filter((code) => !existingCodes.has(code)),
    [existingCodes],
  );

  const ensureOne = useMutation({
    mutationFn: async (action: CatalogAction) => {
      setEnsuringCode(action.code);
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return mockCreatePermission({ code: action.code, description: action.description });
      }
      return createPermission({ code: action.code, description: action.description });
    },
    onSuccess: (created) => {
      setEnsuringCode(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-permissions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      push({
        tone: 'success',
        title: 'Permission added',
        description: `${created.code} is available for role assignment.`,
      });
    },
    onError: (error) => {
      setEnsuringCode(null);
      push({
        tone: 'error',
        title: 'Create failed',
        description: error instanceof ApiClientError ? error.message : 'Could not create permission.',
      });
    },
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      const created: string[] = [];
      for (const code of missingCodes) {
        const description = catalogDescription(code);
        if (appConfig.useMockApi) {
          await new Promise((resolve) => setTimeout(resolve, 40));
          mockCreatePermission({ code, description });
        } else {
          try {
            await createPermission({ code, description });
          } catch (error) {
            if (error instanceof ApiClientError && error.status === 409) continue;
            throw error;
          }
        }
        created.push(code);
      }
      return created;
    },
    onSuccess: (created) => {
      setSyncConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-permissions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      push({
        tone: 'success',
        title: 'Catalog synced',
        description:
          created.length > 0
            ? `Added ${created.length} permission(s). Assign them on Roles.`
            : 'Catalog already complete.',
      });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Sync failed',
        description: error instanceof ApiClientError ? error.message : 'Could not sync permissions.',
      });
    },
  });

  const columns = useMemo<DataColumn<AdminPermission>[]>(
    () => [
      {
        id: 'action',
        header: 'Permission action',
        cell: (row) => {
          const meta = catalogDescription(row.code);
          return (
            <div>
              <p className="text-sm font-medium text-text-primary">
                {row.description || meta}
              </p>
              <p className="font-mono text-[11px] text-text-muted">{row.code}</p>
            </div>
          );
        },
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
              Module permission actions for the admin console — Read, Edit, Delete, and module-specific
              actions (Review, Manage, Operate, Notes). Sync the catalog, then assign actions on{' '}
              <Link to="/admin/roles" className="text-primary hover:underline">
                Roles
              </Link>
              .
            </p>
          </div>
          <Button
            onClick={() => setSyncConfirmOpen(true)}
            disabled={syncAll.isPending || missingCodes.length === 0}
          >
            {missingCodes.length === 0
              ? 'Catalog complete'
              : `Add ${missingCodes.length} missing action${missingCodes.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Permission actions by module</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Covers every admin-end area. Edit maps to API <code className="font-mono text-xs">:write</code>{' '}
          where that is how backends are gated today.
        </p>
        <div className="mt-4">
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
            <PermissionActionMatrix
              mode="catalog"
              existingCodes={existingCodes}
              onEnsure={(action) => void ensureOne.mutateAsync(action)}
              ensuringCode={ensuringCode}
              disabled={ensureOne.isPending || syncAll.isPending || listQuery.isLoading}
            />
          )}
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Live catalog</h3>
        {listQuery.isError ? null : (
          <DataTable
            columns={columns}
            rows={listQuery.data ?? []}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyTitle="No permissions"
            emptyDescription="Sync the module catalog to create permission actions."
          />
        )}
      </section>

      <ConfirmDialog
        open={syncConfirmOpen}
        title="Add missing permission actions?"
        description={`Create ${missingCodes.length} catalog permission(s). Existing roles are unchanged until you assign them on Roles.`}
        confirmLabel="Add missing"
        tone="primary"
        busy={syncAll.isPending}
        onClose={() => setSyncConfirmOpen(false)}
        onConfirm={() => void syncAll.mutateAsync()}
      />
    </div>
  );
}
