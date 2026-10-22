import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { mockBroadcastPushMessage } from '@/mocks/notifications';
import { broadcastAdminNotification } from '@/services/api/notifications';
import { ApiClientError } from '@/types/api';
import type { BroadcastPushResult } from '@/types/notifications';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Message is required').max(2000),
  category: z.string().trim().max(80).optional(),
});

export function PushMessagePage() {
  const { can } = useAuth();
  const { push } = useToast();
  const allowed = can('notifications:write');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('ADMIN');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSent, setLastSent] = useState<BroadcastPushResult | null>(null);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        title,
        body,
        category: category || undefined,
      });
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
        category: parsed.data.category || 'ADMIN',
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return mockBroadcastPushMessage(payload);
      }
      return broadcastAdminNotification(payload);
    },
    onSuccess: (result) => {
      setConfirmOpen(false);
      setLastSent(result);
      push({
        tone: 'success',
        title: 'Push message sent',
        description: `${result.recipientCount} notification${result.recipientCount === 1 ? '' : 's'}, ${result.devicePushCount} device push${result.devicePushCount === 1 ? '' : 'es'}${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}.`,
      });
      setTitle('');
      setBody('');
      setCategory('ADMIN');
    },
    onError: (error) => {
      setConfirmOpen(false);
      push({
        tone: 'error',
        title: 'Send failed',
        description:
          error instanceof ApiClientError ? error.message : 'Could not send the push message.',
      });
    },
  });

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="notifications:write is required to send push messages to all users."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold text-text-primary">Push Message</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Compose a push notification and send it to every app user. Recipients without a registered
          device still get an in-app notification record.
        </p>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h2 className="text-base font-semibold text-text-primary">Compose</h2>
        <form
          className="mt-4 max-w-xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = schema.safeParse({
              title,
              body,
              category: category || undefined,
            });
            if (!parsed.success) {
              const next: Record<string, string> = {};
              for (const issue of parsed.error.issues) {
                next[String(issue.path[0] ?? 'form')] = issue.message;
              }
              setErrors(next);
              return;
            }
            setErrors({});
            setConfirmOpen(true);
          }}
        >
          <Input
            label="Title"
            name="title"
            value={title}
            maxLength={200}
            placeholder="e.g. Platform maintenance"
            error={errors.title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label className="block space-y-1.5" htmlFor="push-body">
            <span className="mb-1 block text-sm font-medium text-text-primary">Message</span>
            <textarea
              id="push-body"
              name="body"
              rows={5}
              maxLength={2000}
              value={body}
              placeholder="Write the message users will see on their devices…"
              onChange={(event) => setBody(event.target.value)}
              className={
                'w-full rounded-[0.6rem] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60' +
                (errors.body ? ' border-danger focus:border-danger focus:ring-danger/20' : '')
              }
            />
            <span className="flex justify-between text-xs text-text-muted">
              {errors.body ? <span className="text-danger">{errors.body}</span> : <span />}
              <span>{body.length}/2000</span>
            </span>
          </label>

          <Input
            label="Category (optional)"
            name="category"
            value={category}
            maxLength={80}
            placeholder="ADMIN"
            error={errors.category}
            onChange={(event) => setCategory(event.target.value)}
          />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={sendMutation.isPending}>
              Send to all users
            </Button>
            <p className="text-xs text-text-secondary">
              You will confirm before the message is delivered.
            </p>
          </div>
        </form>

        {lastSent ? (
          <div className="mt-5 space-y-1 rounded-[0.6rem] border border-border bg-surface-secondary/40 px-3 py-2 text-sm text-text-secondary">
            <p>
              Last send: “{lastSent.title}” → {lastSent.recipientCount} recipient
              {lastSent.recipientCount === 1 ? '' : 's'}.
            </p>
            <p>
              Device pushes: {lastSent.devicePushCount}
              {lastSent.failedCount > 0 ? ` (${lastSent.failedCount} failed)` : ''}
              {' · '}
              FCM: {lastSent.fcmEnabled ? 'enabled' : 'stub/logging'}
            </p>
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Send push to all users?"
        description={`Push “${title.trim() || '—'}” to every app user? This cannot be undone.`}
        confirmLabel="Send push"
        tone="primary"
        busy={sendMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => sendMutation.mutate()}
      />
    </div>
  );
}
