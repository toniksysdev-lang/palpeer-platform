import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Mail } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import {
  mockDeleteBusinessInterest,
  mockDeleteBusinessInterests,
  mockListBusinessInterests,
  mockSendBusinessInterestEmail,
} from '@/mocks/businessWaitlist';
import {
  deleteBusinessInterest,
  deleteBusinessInterests,
  listBusinessInterests,
  sendBusinessInterestEmail,
} from '@/services/api/businessWaitlist';
import { ApiClientError } from '@/types/api';
import type { BusinessInterest } from '@/types/businessWaitlist';

const schema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  body: z.string().trim().min(1, 'Message is required').max(5000),
});

type ConfirmMode =
  | { kind: 'email'; mode: 'selected' | 'all' }
  | { kind: 'delete'; mode: 'one' | 'selected'; row?: BusinessInterest };

export function BusinessWaitlistPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const allowed = can('promotions:write');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ConfirmMode | null>(null);

  const listQuery = useQuery({
    queryKey: ['business-account-interests', appConfig.useMockApi],
    enabled: allowed,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockListBusinessInterests();
      }
      return listBusinessInterests();
    },
  });

  const rows = listQuery.data ?? [];
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((row) => row.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const validateCompose = () => {
    const parsed = schema.safeParse({ subject, body });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0] ?? 'form')] = issue.message;
      }
      setErrors(next);
      return null;
    }
    setErrors({});
    return parsed.data;
  };

  const sendMutation = useMutation({
    mutationFn: async (mode: 'selected' | 'all') => {
      const parsed = validateCompose();
      if (!parsed) {
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the highlighted fields.');
      }
      if (mode === 'selected' && selected.size === 0) {
        throw new ApiClientError(400, 'RECIPIENTS_REQUIRED', 'Select at least one email.');
      }
      const payload = {
        subject: parsed.subject,
        body: parsed.body,
        all: mode === 'all',
        ids: mode === 'all' ? undefined : Array.from(selected),
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockSendBusinessInterestEmail(payload);
      }
      return sendBusinessInterestEmail(payload);
    },
    onSuccess: (result, mode) => {
      setConfirm(null);
      push({
        tone: 'success',
        title: 'Email sent',
        description: `${result.sentCount} sent${
          result.failedCount > 0 ? `, ${result.failedCount} failed` : ''
        }${mode === 'all' ? ' (all waitlist)' : ''}.`,
      });
      setSubject('');
      setBody('');
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ['business-account-interests'] });
    },
    onError: (error) => {
      setConfirm(null);
      push({
        tone: 'error',
        title: 'Send failed',
        description:
          error instanceof ApiClientError ? error.message : 'Could not send waitlist email.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { mode: 'one' | 'selected'; id?: string }) => {
      if (payload.mode === 'one') {
        if (!payload.id) {
          throw new ApiClientError(400, 'RECIPIENTS_REQUIRED', 'Nothing to delete.');
        }
        if (appConfig.useMockApi) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          mockDeleteBusinessInterest(payload.id);
          return { deletedCount: 1 };
        }
        await deleteBusinessInterest(payload.id);
        return { deletedCount: 1 };
      }
      const ids = Array.from(selected);
      if (ids.length === 0) {
        throw new ApiClientError(400, 'RECIPIENTS_REQUIRED', 'Select at least one email.');
      }
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mockDeleteBusinessInterests(ids);
      }
      return deleteBusinessInterests(ids);
    },
    onSuccess: (result) => {
      setConfirm(null);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ['business-account-interests'] });
      push({
        tone: 'success',
        title: result.deletedCount === 1 ? 'Email removed' : 'Emails removed',
        description:
          result.deletedCount === 1
            ? 'Removed 1 address from the waitlist.'
            : `Removed ${result.deletedCount} addresses from the waitlist.`,
      });
    },
    onError: (error) => {
      setConfirm(null);
      push({
        tone: 'error',
        title: 'Could not delete',
        description:
          error instanceof ApiClientError ? error.message : 'Could not remove waitlist email.',
      });
    },
  });

  const columns = useMemo<DataColumn<BusinessInterest>[]>(
    () => [
      {
        id: 'select',
        header: '',
        className: 'w-10',
        cell: (row) => (
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleOne(row.id)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${row.email}`}
            className="h-4 w-4 rounded border-border text-primary"
          />
        ),
      },
      {
        id: 'email',
        header: 'Email',
        cell: (row) => <span className="font-medium text-text-primary">{row.email}</span>,
      },
      {
        id: 'source',
        header: 'Source',
        cell: (row) => <span className="text-text-secondary">{row.source}</span>,
      },
      {
        id: 'createdAt',
        header: 'Submitted',
        cell: (row) => (
          <span className="text-text-secondary">{formatDateTime(row.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: (row) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setConfirm({ kind: 'delete', mode: 'one', row });
              }}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [selected],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="promotions:write is required to view the business waitlist."
      />
    );
  }

  const emailConfirmCount =
    confirm?.kind === 'email'
      ? confirm.mode === 'all'
        ? rows.length
        : selected.size
      : 0;
  const deleteConfirmCount =
    confirm?.kind === 'delete'
      ? confirm.mode === 'one'
        ? 1
        : selected.size
      : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold text-text-primary">Business waitlist</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Emails submitted from the mobile “Business accounts are not ready yet” screen. Select one
          or more addresses, or email everyone on the list.
        </p>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">
            Waitlist emails
            {rows.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-text-muted">({rows.length})</span>
            ) : null}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={rows.length === 0}
                className="h-4 w-4 rounded border-border text-primary"
              />
              Select all
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!someSelected || deleteMutation.isPending}
              onClick={() => setConfirm({ kind: 'delete', mode: 'selected' })}
            >
              Delete selected ({selected.size})
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {listQuery.isError ? (
            <ErrorState
              description={
                listQuery.error instanceof ApiClientError
                  ? listQuery.error.message
                  : 'Could not load waitlist emails.'
              }
              onRetry={() => void listQuery.refetch()}
            />
          ) : listQuery.isLoading ? (
            <DataTable
              columns={columns}
              rows={[]}
              rowKey={(row) => row.id}
              loading
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No waitlist emails yet"
              description="When someone submits an email on the business waitlist screen, it will show here."
            />
          ) : (
            <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
          )}
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold text-text-primary">Compose email</h2>
        </div>
        <form
          className="mt-4 max-w-xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validateCompose()) return;
            if (!someSelected && rows.length === 0) return;
            setConfirm({ kind: 'email', mode: someSelected ? 'selected' : 'all' });
          }}
        >
          <Input
            label="Subject"
            name="subject"
            value={subject}
            maxLength={200}
            placeholder="Business accounts are ready"
            error={errors.subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <label className="block space-y-1.5" htmlFor="biz-body">
            <span className="mb-1 block text-sm font-medium text-text-primary">Message</span>
            <textarea
              id="biz-body"
              name="body"
              rows={6}
              maxLength={5000}
              value={body}
              placeholder="Tell waitlist contacts that business accounts are available…"
              onChange={(event) => setBody(event.target.value)}
              className={
                'w-full rounded-[0.6rem] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60' +
                (errors.body ? ' border-danger focus:border-danger focus:ring-danger/20' : '')
              }
            />
            <span className="flex justify-between text-xs text-text-muted">
              {errors.body ? <span className="text-danger">{errors.body}</span> : <span />}
              <span>
                {body.length}/5000
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!someSelected || sendMutation.isPending || rows.length === 0}
              onClick={() => {
                if (!validateCompose()) return;
                setConfirm({ kind: 'email', mode: 'selected' });
              }}
            >
              Send to selected ({selected.size})
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={rows.length === 0 || sendMutation.isPending}
              onClick={() => {
                if (!validateCompose()) return;
                setConfirm({ kind: 'email', mode: 'all' });
              }}
            >
              Send to all ({rows.length})
            </Button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={confirm?.kind === 'email'}
        title={
          confirm?.kind === 'email' && confirm.mode === 'all'
            ? 'Email entire waitlist?'
            : 'Email selected addresses?'
        }
        description={`This will send your message to ${emailConfirmCount} address${
          emailConfirmCount === 1 ? '' : 'es'
        }.`}
        confirmLabel="Send email"
        tone="primary"
        busy={sendMutation.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'email') sendMutation.mutate(confirm.mode);
        }}
      />

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title={
          confirm?.kind === 'delete' && confirm.mode === 'one'
            ? 'Remove this email?'
            : 'Remove selected emails?'
        }
        description={
          confirm?.kind === 'delete' && confirm.mode === 'one' && confirm.row
            ? `Remove ${confirm.row.email} from the business waitlist? This cannot be undone.`
            : `Remove ${deleteConfirmCount} address${
                deleteConfirmCount === 1 ? '' : 'es'
              } from the waitlist? This cannot be undone.`
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleteMutation.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind !== 'delete') return;
          deleteMutation.mutate({
            mode: confirm.mode,
            id: confirm.row?.id,
          });
        }}
      />
    </div>
  );
}
