import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BadgePercent } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ContractPendingState } from '@/components/feedback/ContractPendingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { mockCreatePromotion, mockListActivePromotions } from '@/mocks/promotions';
import { createPromotion, listActivePromotions } from '@/services/api/promotions';
import { ApiClientError } from '@/types/api';
import {
  PROMOTION_TYPES,
  type PromotionSummary,
  type PromotionType,
} from '@/types/promotions';

const createSchema = z.object({
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  promotionType: z.enum(PROMOTION_TYPES),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  bonusAmount: z.string().optional(),
  bonusCurrencyCode: z.string().trim().max(10).optional(),
});

function localToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function PromotionsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can('promotions:write');

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promotionType, setPromotionType] = useState<PromotionType>('CAMPAIGN');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusCurrencyCode, setBonusCurrencyCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ['promotions-active', appConfig.useMockApi],
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockListActivePromotions();
      }
      return listActivePromotions();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createSchema.safeParse({
        code,
        title,
        description: description || undefined,
        promotionType,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        bonusAmount: bonusAmount || undefined,
        bonusCurrencyCode: bonusCurrencyCode || undefined,
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
        ...parsed.data,
        startsAt: localToIso(parsed.data.startsAt) ?? null,
        endsAt: localToIso(parsed.data.endsAt) ?? null,
        bonusAmount: parsed.data.bonusAmount ?? null,
        bonusCurrencyCode: parsed.data.bonusCurrencyCode ?? null,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockCreatePromotion(payload);
      }
      return createPromotion(payload);
    },
    onSuccess: async (created) => {
      setConfirmOpen(false);
      push({
        tone: 'success',
        title: 'Promotion created',
        description: `${created.code} has been created.`,
      });
      setCode('');
      setTitle('');
      setDescription('');
      setBonusAmount('');
      setBonusCurrencyCode('');
      setStartsAt('');
      setEndsAt('');
      await queryClient.invalidateQueries({ queryKey: ['promotions-active'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Create failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const columns = useMemo<DataColumn<PromotionSummary>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        cell: (row) => <span className="font-mono text-xs font-medium">{row.code}</span>,
      },
      {
        id: 'title',
        header: 'Title',
        cell: (row) => row.title,
      },
      {
        id: 'type',
        header: 'Type',
        cell: (row) => <Badge tone="neutral">{row.promotionType}</Badge>,
      },
      {
        id: 'active',
        header: 'Active',
        cell: (row) => (
          <Badge tone={row.active ? 'success' : 'danger'}>{row.active ? 'Yes' : 'No'}</Badge>
        ),
      },
      {
        id: 'bonus',
        header: 'Bonus',
        cell: (row) =>
          row.bonusAmount != null
            ? `${formatDecimal(row.bonusAmount)} ${row.bonusCurrencyCode ?? ''}`.trim()
            : '—',
      },
      {
        id: 'window',
        header: 'Window',
        cell: (row) => (
          <span className="text-xs text-text-secondary">
            {formatDateTime(row.startsAt)} → {formatDateTime(row.endsAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Promotions</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              View active promotions and create new ones.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Active promotions</h3>
        {listQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : listQuery.isError ? (
          <ErrorState
            description={
              listQuery.error instanceof ApiClientError
                ? listQuery.error.message
                : 'Failed to load promotions.'
            }
            onRetry={() => void listQuery.refetch()}
          />
        ) : (listQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No active promotions"
            description="Create a promotion below to get started."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={listQuery.data ?? []}
            rowKey={(row) => row.id}
          />
        )}
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Create promotion</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Bonus amounts are saved exactly as entered.
        </p>
        {!canWrite ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="promotions:write is required to create promotions."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              label="Code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              error={errors.code}
              placeholder="SUMMER25"
            />
            <Input
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={errors.title}
            />
            <Select
              label="Type"
              value={promotionType}
              onChange={(event) => setPromotionType(event.target.value as PromotionType)}
            >
              {PROMOTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              error={errors.description}
            />
            <Input
              label="Starts at"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
            <Input
              label="Ends at"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
            <Input
              label="Bonus amount"
              value={bonusAmount}
              onChange={(event) => setBonusAmount(event.target.value)}
              inputMode="decimal"
              placeholder="Optional"
            />
            <Input
              label="Bonus currency"
              value={bonusCurrencyCode}
              onChange={(event) => setBonusCurrencyCode(event.target.value.toUpperCase())}
              placeholder="CAD"
            />
            <div className="md:col-span-2">
              <Button onClick={() => setConfirmOpen(true)}>Review & create</Button>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Referral inventory</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Cross-user referral codes and pending bonuses are available in the Referrals module.
          </p>
          <Link
            to="/admin/referrals"
            className="mt-3 inline-flex text-sm text-primary hover:underline"
          >
            Open Referrals →
          </Link>
        </section>
        <ContractPendingState
          title="Campaign formulas & eligibility engines"
          description="Eligibility rules, usage analytics, and campaign performance dashboards are not available yet."
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Create promotion"
        description={`Create ${code || '—'} (${promotionType}) titled “${title || '—'}”?`}
        confirmLabel="Create promotion"
        tone="primary"
        busy={createMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => createMutation.mutate()}
      />
    </div>
  );
}
