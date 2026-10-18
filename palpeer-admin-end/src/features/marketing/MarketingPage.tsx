import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import {
  mockCreateMarketingAdvert,
  mockDeleteMarketingAdvert,
  mockListMarketingAdverts,
  mockUpdateMarketingAdvert,
} from '@/mocks/marketing';
import {
  createMarketingAdvert,
  deleteMarketingAdvert,
  listMarketingAdverts,
  updateMarketingAdvert,
} from '@/services/api/marketing';
import { ApiClientError } from '@/types/api';
import type { MarketingAdvert } from '@/types/marketing';

const formSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Brief is required').max(500),
  imageUrl: z
    .string()
    .trim()
    .url('Enter a valid image URL')
    .max(1000)
    .refine((value) => /^https?:\/\//i.test(value), 'Image URL must be http(s)'),
  ctaLabel: z.string().trim().min(1, 'CTA label is required').max(80),
  ctaPath: z.string().trim().min(1, 'CTA path is required').max(200),
  sortOrder: z.string().trim().optional(),
  active: z.boolean(),
});

const emptyForm = {
  title: '',
  body: '',
  imageUrl: '',
  ctaLabel: '',
  ctaPath: '',
  sortOrder: '0',
  active: true,
};

export function MarketingPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const allowed = can('promotions:write');

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['marketing-adverts', appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockListMarketingAdverts();
      }
      return listMarketingAdverts();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.safeParse(form);
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          next[String(issue.path[0] ?? 'form')] = issue.message;
        }
        setErrors(next);
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the highlighted fields.');
      }
      setErrors({});
      const payload = {
        title: parsed.data.title,
        body: parsed.data.body,
        imageUrl: parsed.data.imageUrl,
        ctaLabel: parsed.data.ctaLabel,
        ctaPath: parsed.data.ctaPath.startsWith('/')
          ? parsed.data.ctaPath
          : `/${parsed.data.ctaPath}`,
        sortOrder: Number(parsed.data.sortOrder || '0') || 0,
        active: parsed.data.active,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return editingId
          ? mockUpdateMarketingAdvert(editingId, payload)
          : mockCreateMarketingAdvert(payload);
      }
      return editingId
        ? updateMarketingAdvert(editingId, payload)
        : createMarketingAdvert(payload);
    },
    onSuccess: async () => {
      push({
        tone: 'success',
        title: editingId ? 'Advert updated' : 'Advert created',
        description: 'Home carousel will show active adverts.',
      });
      setForm(emptyForm);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['marketing-adverts'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Save failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        mockDeleteMarketingAdvert(id);
        return;
      }
      await deleteMarketingAdvert(id);
    },
    onSuccess: async () => {
      setDeleteId(null);
      if (editingId === deleteId) {
        setEditingId(null);
        setForm(emptyForm);
      }
      push({ tone: 'success', title: 'Advert deleted' });
      await queryClient.invalidateQueries({ queryKey: ['marketing-adverts'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Delete failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const columns = useMemo<DataColumn<MarketingAdvert>[]>(
    () => [
      {
        id: 'preview',
        header: 'Preview',
        cell: (row) => (
          <div
            className="h-12 w-20 overflow-hidden rounded-[0.45rem] border border-border bg-surface-secondary bg-cover bg-center"
            style={{ backgroundImage: `url(${row.imageUrl})` }}
            title={row.imageUrl}
          />
        ),
      },
      {
        id: 'title',
        header: 'Advert',
        cell: (row) => (
          <div className="min-w-[12rem]">
            <p className="font-medium text-text-primary">{row.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{row.body}</p>
          </div>
        ),
      },
      {
        id: 'cta',
        header: 'CTA',
        cell: (row) => (
          <div className="text-xs">
            <p className="font-medium text-text-primary">{row.ctaLabel}</p>
            <p className="font-mono text-text-secondary">{row.ctaPath}</p>
          </div>
        ),
      },
      {
        id: 'sort',
        header: 'Order',
        cell: (row) => row.sortOrder,
      },
      {
        id: 'active',
        header: 'Active',
        cell: (row) => (
          <Badge tone={row.active ? 'success' : 'danger'}>{row.active ? 'Yes' : 'No'}</Badge>
        ),
      },
      {
        id: 'updated',
        header: 'Updated',
        cell: (row) => formatDateTime(row.updatedAt ?? row.createdAt),
      },
      {
        id: 'actions',
        header: '',
        cell: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditingId(row.id);
                setForm({
                  title: row.title,
                  body: row.body,
                  imageUrl: row.imageUrl,
                  ctaLabel: row.ctaLabel,
                  ctaPath: row.ctaPath,
                  sortOrder: String(row.sortOrder),
                  active: row.active,
                });
                setErrors({});
              }}
            >
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDeleteId(row.id)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="promotions:write is required to manage marketing adverts."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold text-text-primary">Marketing</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Manage home-screen promotional slides. Active adverts appear in the mobile carousel with
          image backgrounds, titles, brief copy, and a CTA into the app.
        </p>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-base font-semibold text-text-primary">
            {editingId ? 'Edit advert' : 'New advert'}
          </h2>
        </div>
        <form
          className="grid max-w-3xl gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="md:col-span-2">
            <Input
              label="Title"
              value={form.title}
              maxLength={200}
              error={errors.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block space-y-1.5" htmlFor="marketing-body">
              <span className="mb-1 block text-sm font-medium text-text-primary">
                Brief information
              </span>
              <textarea
                id="marketing-body"
                rows={3}
                maxLength={500}
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({ ...current, body: event.target.value }))
                }
                className={
                  'w-full rounded-[0.6rem] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/25' +
                  (errors.body ? ' border-danger focus:border-danger focus:ring-danger/20' : '')
                }
              />
              {errors.body ? <span className="block text-xs text-danger">{errors.body}</span> : null}
            </label>
          </div>
          <div className="md:col-span-2">
            <Input
              label="Image background URL"
              value={form.imageUrl}
              maxLength={1000}
              placeholder="https://…"
              error={errors.imageUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
            />
          </div>
          <Input
            label="CTA button label"
            value={form.ctaLabel}
            maxLength={80}
            error={errors.ctaLabel}
            onChange={(event) =>
              setForm((current) => ({ ...current, ctaLabel: event.target.value }))
            }
          />
          <Input
            label="CTA path"
            value={form.ctaPath}
            maxLength={200}
            placeholder="/exchange"
            error={errors.ctaPath}
            onChange={(event) =>
              setForm((current) => ({ ...current, ctaPath: event.target.value }))
            }
          />
          <Input
            label="Sort order"
            type="number"
            value={form.sortOrder}
            error={errors.sortOrder}
            onChange={(event) =>
              setForm((current) => ({ ...current, sortOrder: event.target.value }))
            }
          />
          <label className="flex items-end gap-2 pb-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({ ...current, active: event.target.checked }))
              }
              className="h-4 w-4 rounded border-border"
            />
            Active on home carousel
          </label>
          {form.imageUrl ? (
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                Preview
              </p>
              <div
                className="relative h-24 overflow-hidden rounded-[0.6rem] bg-cover bg-center"
                style={{ backgroundImage: `url(${form.imageUrl})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-transparent" />
                <div className="relative z-10 flex h-full flex-col justify-center gap-1 px-4 text-white">
                  <p className="text-sm font-semibold">{form.title || 'Title'}</p>
                  <p className="line-clamp-1 text-xs text-white/85">{form.body || 'Brief copy'}</p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create advert'}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setErrors({});
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-text-primary">All adverts</h2>
        {listQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : listQuery.isError ? (
          <ErrorState
            description={
              listQuery.error instanceof ApiClientError
                ? listQuery.error.message
                : 'Failed to load adverts.'
            }
            onRetry={() => void listQuery.refetch()}
          />
        ) : (listQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No marketing adverts"
            description="Create an advert above to show it on the mobile home carousel."
          />
        ) : (
          <DataTable columns={columns} rows={listQuery.data ?? []} rowKey={(row) => row.id} />
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete advert?"
        description="This removes the advert from the home carousel. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deleteMutation.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
      />
    </div>
  );
}
