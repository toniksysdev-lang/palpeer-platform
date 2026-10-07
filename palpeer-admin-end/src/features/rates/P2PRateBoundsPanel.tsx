import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDecimal } from '@/lib/format';
import { listCurrencies } from '@/services/api/currencies';
import {
  deleteP2PRateBound,
  listP2PRateBounds,
  upsertP2PRateBound,
} from '@/services/api/p2pRateBounds';
import { ApiClientError } from '@/types/api';
import type { P2PRateBound } from '@/types/rates';

const boundSchema = z
  .object({
    baseCurrencyCode: z.string().trim().min(3).max(10),
    quoteCurrencyCode: z.string().trim().min(3).max(10),
    minRate: z.string().trim().refine((value) => Number(value) > 0, 'Min rate must be > 0'),
    maxRate: z.string().trim().refine((value) => Number(value) > 0, 'Max rate must be > 0'),
  })
  .refine((value) => Number(value.minRate) <= Number(value.maxRate), {
    message: 'Min rate must be less than or equal to max rate',
    path: ['maxRate'],
  });

/** P2P min/max post bounds — lives on the Rates module (P2P channel). */
export function P2PRateBoundsPanel() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can('p2p:write');

  const [base, setBase] = useState('');
  const [quote, setQuote] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState<P2PRateBound | null>(null);

  const currenciesQuery = useQuery({
    queryKey: ['currencies', appConfig.useMockApi],
    queryFn: () => listCurrencies(),
  });

  const boundsQuery = useQuery({
    queryKey: ['p2p-rate-bounds', appConfig.useMockApi],
    queryFn: () => listP2PRateBounds(),
  });

  const currencyOptions = useMemo(
    () => [...(currenciesQuery.data ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [currenciesQuery.data],
  );

  const upsertMutation = useMutation({
    mutationFn: () =>
      upsertP2PRateBound({
        baseCurrencyCode: base,
        quoteCurrencyCode: quote,
        minRate,
        maxRate,
      }),
    onSuccess: () => {
      setConfirmOpen(false);
      setMinRate('');
      setMaxRate('');
      void queryClient.invalidateQueries({ queryKey: ['p2p-rate-bounds'] });
      push({
        tone: 'success',
        title: 'Rate bounds saved',
        description: `${base}/${quote} min ${minRate} · max ${maxRate}`,
      });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Could not save bounds',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteP2PRateBound(id),
    onSuccess: () => {
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ['p2p-rate-bounds'] });
      push({ tone: 'success', title: 'Rate bounds removed' });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Could not remove bounds',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  function reviewSave() {
    const parsed = boundSchema.safeParse({
      baseCurrencyCode: base,
      quoteCurrencyCode: quote,
      minRate,
      maxRate,
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
    if (base === quote) {
      setErrors({ quoteCurrencyCode: 'Base and quote must differ' });
      return;
    }
    setErrors({});
    setConfirmOpen(true);
  }

  const columns: DataColumn<P2PRateBound>[] = [
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
      id: 'min',
      header: 'Min rate',
      cell: (row) => <span className="font-mono">{formatDecimal(row.minRate)}</span>,
    },
    {
      id: 'max',
      header: 'Max rate',
      cell: (row) => <span className="font-mono">{formatDecimal(row.maxRate)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: (row) =>
        canWrite ? (
          <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>
            Remove
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">P2P post bounds</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Minimum and maximum rate users may post when creating P2P requests for each currency pair.
        </p>
        {!canWrite ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="p2p:write is required to change rate bounds."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Select label="Base" value={base} onChange={(e) => setBase(e.target.value)}>
              <option value="">Select base</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </Select>
            <Select label="Quote" value={quote} onChange={(e) => setQuote(e.target.value)}>
              <option value="">Select quote</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </Select>
            <Input
              label="Minimum rate"
              value={minRate}
              onChange={(e) => setMinRate(e.target.value)}
              error={errors.minRate}
              inputMode="decimal"
              placeholder="e.g. 1000"
            />
            <Input
              label="Maximum rate"
              value={maxRate}
              onChange={(e) => setMaxRate(e.target.value)}
              error={errors.maxRate || errors.quoteCurrencyCode}
              inputMode="decimal"
              placeholder="e.g. 1200"
            />
            <div className="md:col-span-2 lg:col-span-4">
              <Button onClick={reviewSave}>Review & save</Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Configured P2P bounds</h3>
        <DataTable
          columns={columns}
          rows={boundsQuery.data ?? []}
          rowKey={(row) => row.id}
          loading={boundsQuery.isLoading}
          error={
            boundsQuery.error instanceof ApiClientError
              ? boundsQuery.error.message
              : boundsQuery.error
                ? 'Failed to load rate bounds.'
                : null
          }
          onRetry={() => void boundsQuery.refetch()}
          emptyTitle="No rate bounds"
          emptyDescription="Until bounds are set for a pair, users can post any positive rate."
        />
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Save P2P rate bounds"
        description={`Users posting ${base}/${quote} will only be able to use rates between ${minRate || '—'} and ${maxRate || '—'}.`}
        confirmLabel="Save bounds"
        tone="primary"
        busy={upsertMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => upsertMutation.mutate()}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove rate bounds"
        description={
          removing
            ? `Remove limits for ${removing.baseCurrencyCode}/${removing.quoteCurrencyCode}? Users will no longer be constrained on this pair.`
            : ''
        }
        confirmLabel="Remove"
        tone="danger"
        busy={deleteMutation.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && deleteMutation.mutate(removing.id)}
      />
    </>
  );
}
