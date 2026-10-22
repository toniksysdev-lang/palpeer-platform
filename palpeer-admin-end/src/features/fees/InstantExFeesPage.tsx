import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Percent } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDecimal } from '@/lib/format';
import { listLatestExchangeRates } from '@/services/api/currencies';
import {
  createInstantExFeeTier,
  deleteInstantExFeeTier,
  listInstantExFeeTiers,
  updateInstantExFeeTier,
} from '@/services/api/instantExFees';
import { ApiClientError } from '@/types/api';
import type { InstantExFeeTier, P2PFeeType } from '@/types/fees';

const feeSchema = z
  .object({
    baseCurrencyCode: z.string().trim().min(3).max(10),
    quoteCurrencyCode: z.string().trim().min(3).max(10),
    feeType: z.enum(['FIXED', 'PERCENTAGE']),
    feeValue: z.string().trim().refine((value) => Number(value) > 0, 'Fee must be greater than 0'),
    minAmount: z
      .string()
      .trim()
      .refine((value) => Number(value) >= 0, 'Min amount must be 0 or greater'),
    maxAmount: z.string().trim().optional(),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.baseCurrencyCode === value.quoteCurrencyCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Base and quote must differ',
        path: ['quoteCurrencyCode'],
      });
    }
    if (value.feeType === 'PERCENTAGE' && Number(value.feeValue) > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage cannot exceed 100',
        path: ['feeValue'],
      });
    }
    if (value.maxAmount && Number(value.maxAmount) < Number(value.minAmount)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Max must be ≥ min',
        path: ['maxAmount'],
      });
    }
  });

function emptyForm() {
  return {
    base: '',
    quote: '',
    feeType: 'PERCENTAGE' as P2PFeeType,
    feeValue: '',
    minAmount: '0',
    maxAmount: '',
    active: true,
  };
}

export function InstantExFeesPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can('fees:write');

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<InstantExFeeTier | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState<InstantExFeeTier | null>(null);

  const swapPairsQuery = useQuery({
    queryKey: ['exchange-rates-all-latest', 'SWAP', appConfig.useMockApi],
    queryFn: () => listLatestExchangeRates('SWAP'),
  });

  const tiersQuery = useQuery({
    queryKey: ['instantex-fee-tiers', appConfig.useMockApi],
    queryFn: () => listInstantExFeeTiers(),
  });

  /** InstantEX / Swap pairs from Rates → All swap pairs (latest). */
  const swapPairOptions = useMemo(() => {
    const seen = new Set<string>();
    const pairs: { key: string; base: string; quote: string }[] = [];
    for (const row of swapPairsQuery.data ?? []) {
      const base = (row.baseCurrencyCode ?? '').trim().toUpperCase();
      const quote = (row.quoteCurrencyCode ?? '').trim().toUpperCase();
      if (!base || !quote || base === quote) continue;
      const key = `${base}/${quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ key, base, quote });
    }
    return pairs.sort((a, b) => a.key.localeCompare(b.key));
  }, [swapPairsQuery.data]);

  const selectedPairKey =
    form.base && form.quote ? `${form.base.toUpperCase()}/${form.quote.toUpperCase()}` : '';

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        baseCurrencyCode: form.base,
        quoteCurrencyCode: form.quote,
        feeType: form.feeType,
        feeValue: form.feeValue,
        minAmount: form.minAmount,
        maxAmount: form.maxAmount || undefined,
        active: form.active,
      };
      if (editing) {
        return updateInstantExFeeTier(editing.id, payload);
      }
      return createInstantExFeeTier(payload);
    },
    onSuccess: () => {
      setConfirmOpen(false);
      setEditing(null);
      setForm(emptyForm());
      void queryClient.invalidateQueries({ queryKey: ['instantex-fee-tiers'] });
      push({
        tone: 'success',
        title: editing ? 'Fee tier updated' : 'Fee tier created',
      });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Could not save fee tier',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInstantExFeeTier(id),
    onSuccess: () => {
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ['instantex-fee-tiers'] });
      push({ tone: 'success', title: 'Fee tier removed' });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Could not remove fee tier',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  function startEdit(tier: InstantExFeeTier) {
    setEditing(tier);
    setForm({
      base: tier.baseCurrencyCode,
      quote: tier.quoteCurrencyCode,
      feeType: tier.feeType,
      feeValue: String(tier.feeValue),
      minAmount: String(tier.minAmount),
      maxAmount: tier.maxAmount == null ? '' : String(tier.maxAmount),
      active: tier.active,
    });
    setErrors({});
  }

  function reviewSave() {
    const parsed = feeSchema.safeParse({
      baseCurrencyCode: form.base,
      quoteCurrencyCode: form.quote,
      feeType: form.feeType,
      feeValue: form.feeValue,
      minAmount: form.minAmount,
      maxAmount: form.maxAmount || undefined,
      active: form.active,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setConfirmOpen(true);
  }

  const columns: DataColumn<InstantExFeeTier>[] = [
    {
      id: 'pair',
      header: 'Pair',
      cell: (row) => (
        <span className="font-medium text-text-primary">
          {row.baseCurrencyCode}/{row.quoteCurrencyCode}
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge tone={row.feeType === 'FIXED' ? 'neutral' : 'info'}>{row.feeType}</Badge>
      ),
    },
    {
      id: 'value',
      header: 'Fee',
      cell: (row) => (
        <span className="font-mono">
          {row.feeType === 'PERCENTAGE'
            ? `${formatDecimal(row.feeValue)}%`
            : formatDecimal(row.feeValue)}
        </span>
      ),
    },
    {
      id: 'range',
      header: 'Amount range',
      cell: (row) => (
        <span className="font-mono text-sm">
          {formatDecimal(row.minAmount)}
          {' – '}
          {row.maxAmount == null ? '∞' : formatDecimal(row.maxAmount)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={row.active ? 'success' : 'warning'}>{row.active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (row) =>
        canWrite ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>
              Remove
            </Button>
          </div>
        ) : null,
    },
  ];

  const feeLabel =
    form.feeType === 'PERCENTAGE'
      ? `${form.feeValue || '—'}%`
      : `${form.feeValue || '—'} ${form.base || ''}`.trim();

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">
                InstantEX Fees(Profit Margin)
              </h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Configure InstantEX fees as a fixed amount or percentage for InstantEX / Swap pairs
              published on Rates (All swap pairs latest). Amount ranges use the pair base currency
              (e.g. CAD for CAD/NGN). The same tier applies in both directions — CAD→NGN and
              NGN→CAD — and successful exchanges record InstantEX revenue under Platform fees.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-text-primary">
            {editing ? 'Edit fee tier(Profit Margin)' : 'Add fee tier(Profit Margin)'}
          </h3>
          {editing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm());
                setErrors({});
              }}
            >
              Cancel edit
            </Button>
          ) : null}
        </div>
        {!canWrite ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="fees:write is required to create or change InstantEX fee tiers."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Select
              label="InstantEX / Swap pair"
              value={
                swapPairOptions.some((pair) => pair.key === selectedPairKey)
                  ? selectedPairKey
                  : ''
              }
              onChange={(e) => {
                const pair = swapPairOptions.find((item) => item.key === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  base: pair?.base ?? '',
                  quote: pair?.quote ?? '',
                }));
              }}
              error={errors.baseCurrencyCode || errors.quoteCurrencyCode}
              disabled={swapPairsQuery.isLoading}
            >
              <option value="">
                {swapPairsQuery.isLoading
                  ? 'Loading swap pairs…'
                  : swapPairOptions.length === 0
                    ? 'No swap pairs yet — publish on Rates'
                    : 'Select swap pair'}
              </option>
              {swapPairOptions.map((pair) => (
                <option key={pair.key} value={pair.key}>
                  {pair.key}
                </option>
              ))}
              {selectedPairKey &&
              !swapPairOptions.some((pair) => pair.key === selectedPairKey) ? (
                <option value={selectedPairKey}>{selectedPairKey} (not in latest rates)</option>
              ) : null}
            </Select>
            <Select
              label="Fee type"
              value={form.feeType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, feeType: e.target.value as P2PFeeType }))
              }
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </Select>
            <Input
              label={form.feeType === 'PERCENTAGE' ? 'Fee (%)' : 'Fee amount'}
              value={form.feeValue}
              onChange={(e) => setForm((prev) => ({ ...prev, feeValue: e.target.value }))}
              error={errors.feeValue}
              inputMode="decimal"
              placeholder={form.feeType === 'PERCENTAGE' ? 'e.g. 1.5' : 'e.g. 2.00'}
            />
            <Input
              label="Min amount"
              value={form.minAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, minAmount: e.target.value }))}
              error={errors.minAmount}
              inputMode="decimal"
              placeholder="0"
            />
            <Input
              label="Max amount (optional)"
              value={form.maxAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, maxAmount: e.target.value }))}
              error={errors.maxAmount}
              inputMode="decimal"
              placeholder="Leave blank for no upper limit"
            />
            <Select
              label="Status"
              value={form.active ? 'true' : 'false'}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, active: e.target.value === 'true' }))
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
            <div className="md:col-span-2 lg:col-span-3">
              <Button onClick={reviewSave}>{editing ? 'Review & update' : 'Review & create'}</Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Configured fee tiers</h3>
        <DataTable
          columns={columns}
          rows={tiersQuery.data ?? []}
          rowKey={(row) => row.id}
          loading={tiersQuery.isLoading}
          error={
            tiersQuery.error instanceof ApiClientError
              ? tiersQuery.error.message
              : tiersQuery.error
                ? 'Failed to load InstantEX fee tiers.'
                : null
          }
          onRetry={() => void tiersQuery.refetch()}
          emptyTitle="No fee tiers"
          emptyDescription="Add a fixed or percentage fee for an amount range to start charging on InstantEX."
        />
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={editing ? 'Update InstantEX fee tier' : 'Create InstantEX fee tier'}
        description={`${form.base}/${form.quote}: ${feeLabel} for amounts from ${form.minAmount || '—'} to ${form.maxAmount || '∞'} (${form.active ? 'active' : 'inactive'}).`}
        confirmLabel={editing ? 'Save changes' : 'Create tier'}
        tone="primary"
        busy={saveMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => saveMutation.mutate()}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove fee tier"
        description={
          removing
            ? `Remove the ${removing.feeType.toLowerCase()} fee for ${removing.baseCurrencyCode}/${removing.quoteCurrencyCode}?`
            : ''
        }
        confirmLabel="Remove"
        tone="danger"
        busy={deleteMutation.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && deleteMutation.mutate(removing.id)}
      />
    </div>
  );
}
