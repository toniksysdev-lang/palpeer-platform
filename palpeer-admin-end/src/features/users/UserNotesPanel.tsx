import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/providers/ToastProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Pagination } from '@/components/tables/Pagination';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { mockCreateUserNote, mockListUserNotes } from '@/mocks/userNotes';
import { createUserNote, listUserNotes } from '@/services/api/userNotes';
import { ApiClientError } from '@/types/api';
import { USER_NOTE_CATEGORIES, type UserNoteCategory } from '@/types/userNotes';

const MAX_BODY = 4000;
const PAGE_SIZE = 10;

const categoryTone: Record<UserNoteCategory, BadgeTone> = {
  INCIDENT: 'warning',
  FRAUD: 'danger',
  COMPLIANCE: 'info',
  SUPPORT: 'primary',
  GENERAL: 'neutral',
};

export function UserNotesPanel({ userId }: { userId: string }) {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canRead = can('users:notes:read');
  const canWrite = can('users:notes:write');

  const [page, setPage] = useState(0);
  const [category, setCategory] = useState<UserNoteCategory>('INCIDENT');
  const [body, setBody] = useState('');

  const notesQuery = useQuery({
    queryKey: ['admin-user-notes', userId, page, appConfig.useMockApi],
    enabled: Boolean(userId) && canRead,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 150));
        return mockListUserNotes(userId, { page, size: PAGE_SIZE });
      }
      return listUserNotes(userId, { page, size: PAGE_SIZE });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const input = { category, body: body.trim() };
      if (appConfig.useMockApi) {
        await new Promise((r) => setTimeout(r, 150));
        return mockCreateUserNote(userId, input);
      }
      return createUserNote(userId, input);
    },
    onSuccess: async () => {
      setBody('');
      setPage(0);
      push({ tone: 'success', title: 'Note added', description: 'The record is saved and audited.' });
      await queryClient.invalidateQueries({ queryKey: ['admin-user-notes', userId] });
    },
    onError: (error) => {
      const message = error instanceof ApiClientError ? error.message : 'Could not save the note.';
      push({ tone: 'error', title: 'Save failed', description: message });
    },
  });

  const trimmed = body.trim();

  return (
    <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Notes &amp; incident records</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Internal only, never shown to the user. Notes are append-only so the record can&apos;t be
            altered after the fact.
          </p>
        </div>
        {notesQuery.data ? (
          <Badge tone="neutral">{notesQuery.data.totalElements} total</Badge>
        ) : null}
      </div>

      {canWrite ? (
        <form
          className="mt-4 space-y-3 rounded-lg border border-border bg-surface-secondary/40 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) createMutation.mutate();
          }}
        >
          <div className="max-w-xs">
            <Select
              label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value as UserNoteCategory)}
            >
              {USER_NOTE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">Note</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={MAX_BODY}
              rows={4}
              placeholder="What happened, when, what was done, and any reference numbers…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="block text-right text-xs text-text-muted">
              {body.length}/{MAX_BODY}
            </span>
          </label>
          <Button type="submit" disabled={!trimmed || createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : 'Add note'}
          </Button>
        </form>
      ) : null}

      <div className="mt-4">
        {!canRead ? (
          <ErrorState
            title="Permission required"
            description="users:notes:read is required to view notes on this user."
          />
        ) : notesQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : notesQuery.isError ? (
          <ErrorState
            description={
              notesQuery.error instanceof ApiClientError
                ? notesQuery.error.message
                : 'Failed to load notes.'
            }
            onRetry={() => void notesQuery.refetch()}
          />
        ) : (notesQuery.data?.content.length ?? 0) === 0 ? (
          <EmptyState title="No notes yet" description="Incidents and follow-ups you record will appear here." />
        ) : (
          <>
            <ol className="space-y-3">
              {notesQuery.data?.content.map((note) => (
                <li key={note.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <Badge tone={categoryTone[note.category] ?? 'neutral'}>{note.category}</Badge>
                    <span>{formatDateTime(note.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span>{note.authorEmail}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">{note.body}</p>
                </li>
              ))}
            </ol>
            {notesQuery.data && notesQuery.data.totalPages > 1 ? (
              <Pagination
                className="mt-3"
                page={notesQuery.data.number}
                totalPages={notesQuery.data.totalPages}
                totalElements={notesQuery.data.totalElements}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
