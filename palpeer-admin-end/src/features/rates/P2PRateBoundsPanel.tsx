import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import { listCurrencies } from '@/services/api/currencies';
import {
  deleteP2PRateBound,
  listP2PRateBounds,
  upsertP2PRateBound,
} from '@/services/api/p2pRateBounds';
import { ApiClientError } from '@/types/api';
import type { P2PRateBound } from '@/types/rates';
import {
  applyBoundsDisplayEdit,
  displayBoundsForUnit,
  formatExactBoundRate,
  toStoredBounds,
  type BoundsEntryAnchor,
} from './p2pBoundRateMath';

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

/** Table cell rates: stored unit exact; switched unit via reciprocal (integer-snap). */
function formatBoundRate(
  minRate: string | number,
  maxRate: string | number,
  which: 'min' | 'max',
  currencyCode: string,
  switched: boolean,
): string {
  const anchor: BoundsEntryAnchor = {
    switched: false,
    minRate: formatExactBoundRate(minRate) === '—' ? '' : formatExactBoundRate(minRate),
    maxRate: formatExactBoundRate(maxRate) === '—' ? '' : formatExactBoundRate(maxRate),
  };
  const display = displayBoundsForUnit(anchor, switched);
  const raw = formatExactBoundRate(which === 'min' ? display.minRate : display.maxRate);
  if (!raw || raw === '—') return '—';
  return `${raw} ${currencyCode}`;
}

/** P2P min/max post bounds — lives on the Rates module (P2P channel). */
export function P2PRateBoundsPanel() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canWrite = can('p2p:write');

  const [base, setBase] = useState('');
  const [quote, setQuote] = useState('');
  /** Exact typed min/max + unit — flipping Rate Switch re-derives display without losing precision. */
  const [boundsAnchor, setBoundsAnchor] = useState<BoundsEntryAnchor | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState<P2PRateBound | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /**
   * Shared Rate Switch for the form and the configured table.
   * When true, UI shows base-per-quote; API storage stays quote-per-base.
   */
  const [rateSwitched, setRateSwitched] = useState(false);

  const displayBounds = displayBoundsForUnit(boundsAnchor, rateSwitched);
  const minRate = displayBounds.minRate;
  const maxRate = displayBounds.maxRate;

  function toggleRateSwitch() {
    // Keep the typed anchor; displayBoundsForUnit derives the other side (exact on flip-back).
    setRateSwitched((current) => !current);
  }

  function onMinRateChange(value: string) {
    setBoundsAnchor((current) => {
      const shown = displayBoundsForUnit(current, rateSwitched);
      return applyBoundsDisplayEdit(current, rateSwitched, value, shown.maxRate);
    });
  }

  function onMaxRateChange(value: string) {
    setBoundsAnchor((current) => {
      const shown = displayBoundsForUnit(current, rateSwitched);
      return applyBoundsDisplayEdit(current, rateSwitched, shown.minRate, value);
    });
  }

  function clearForm() {
    setEditingId(null);
    setBase('');
    setQuote('');
    setBoundsAnchor(null);
    setErrors({});
  }

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

  const storedForConfirm = toStoredBounds(boundsAnchor, minRate, maxRate, rateSwitched);

  const upsertMutation = useMutation({
    mutationFn: () => {
      const stored = toStoredBounds(boundsAnchor, minRate, maxRate, rateSwitched);
      return upsertP2PRateBound({
        baseCurrencyCode: base,
        quoteCurrencyCode: quote,
        minRate: stored.minRate,
        maxRate: stored.maxRate,
      });
    },
    onSuccess: () => {
      const stored = toStoredBounds(boundsAnchor, minRate, maxRate, rateSwitched);
      setConfirmOpen(false);
      clearForm();
      void queryClient.invalidateQueries({ queryKey: ['p2p-rate-bounds'] });
      push({
        tone: 'success',
        title: 'Rate bounds saved',
        description: `${base}/${quote} min ${stored.minRate} · max ${stored.maxRate} (quote per 1 base)`,
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

  function startEdit(row: P2PRateBound) {
    setEditingId(row.id);
    setBase(row.baseCurrencyCode);
    setQuote(row.quoteCurrencyCode);
    // Always anchor to cleaned quote-per-base so flip-back matches the exact post-bounds input.
    const min = formatExactBoundRate(row.minRate);
    const max = formatExactBoundRate(row.maxRate);
    setBoundsAnchor({
      switched: false,
      minRate: min === '—' ? '' : min,
      maxRate: max === '—' ? '' : max,
    });
    setErrors({});
  }

  function reviewSave() {
    // Validate the display values the admin typed (min ≤ max in the visible unit).
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
    const stored = toStoredBounds(boundsAnchor, minRate, maxRate, rateSwitched);
    if (Number(stored.minRate) > Number(stored.maxRate)) {
      setErrors({ maxRate: 'Min rate must be less than or equal to max rate' });
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
      id: 'direction',
      header: 'Quoted as',
      cell: (row) =>
        rateSwitched ? (
          <span className="text-xs text-text-secondary">
            {row.baseCurrencyCode} per 1 {row.quoteCurrencyCode}
          </span>
        ) : (
          <span className="text-xs text-text-secondary">
            {row.quoteCurrencyCode} per 1 {row.baseCurrencyCode}
          </span>
        ),
    },
    {
      id: 'min',
      header: rateSwitched ? 'Min rate (switched)' : 'Min rate',
      cell: (row) => {
        const currency = rateSwitched ? row.baseCurrencyCode : row.quoteCurrencyCode;
        return (
          <span className="font-mono text-sm">
            {formatBoundRate(row.minRate, row.maxRate, 'min', currency, rateSwitched)}
          </span>
        );
      },
    },
    {
      id: 'max',
      header: rateSwitched ? 'Max rate (switched)' : 'Max rate',
      cell: (row) => {
        const currency = rateSwitched ? row.baseCurrencyCode : row.quoteCurrencyCode;
        return (
          <span className="font-mono text-sm">
            {formatBoundRate(row.minRate, row.maxRate, 'max', currency, rateSwitched)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) =>
        canWrite ? (
          <div className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEdit(row)}
              disabled={editingId === row.id}
            >
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>
              Remove
            </Button>
          </div>
        ) : null,
    },
  ];

  const rateUnitCurrency = rateSwitched ? base : quote;
  const formCurrencyHint =
    base && quote
      ? rateSwitched
        ? `${base} per 1 ${quote}`
        : `${quote} per 1 ${base}`
      : rateSwitched
        ? 'base per 1 quote'
        : 'quote per 1 base';

  const rateSwitchControl = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={toggleRateSwitch}
      className={cn('inline-flex items-center gap-2', rateSwitched && 'ring-1 ring-primary')}
      aria-pressed={rateSwitched}
    >
      <ArrowLeftRight className="h-4 w-4" aria-hidden />
      Rate Switch
    </Button>
  );

  return (
    <>
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {editingId ? 'Edit P2P post bounds' : 'P2P post bounds'}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Minimum and maximum rate users may post when creating P2P requests for each currency
              pair. Bounds are always stored as quote units per 1 base unit — use Rate Switch to
              enter or view them the other way (flip back restores the exact values you typed).
            </p>
          </div>
          {rateSwitchControl}
        </div>
        {!canWrite ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="p2p:write is required to change rate bounds."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Base"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              disabled={Boolean(editingId)}
            >
              <option value="">Select base</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </Select>
            <Select
              label="Quote"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              disabled={Boolean(editingId)}
            >
              <option value="">Select quote</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </Select>
            <Input
              label={
                rateUnitCurrency
                  ? `Minimum rate (${rateUnitCurrency})`
                  : rateSwitched
                    ? 'Minimum rate (base)'
                    : 'Minimum rate (quote)'
              }
              value={minRate}
              onChange={(e) => onMinRateChange(e.target.value)}
              error={errors.minRate}
              inputMode="decimal"
              placeholder={rateSwitched ? 'e.g. 0.001' : 'e.g. 1000'}
            />
            <Input
              label={
                rateUnitCurrency
                  ? `Maximum rate (${rateUnitCurrency})`
                  : rateSwitched
                    ? 'Maximum rate (base)'
                    : 'Maximum rate (quote)'
              }
              value={maxRate}
              onChange={(e) => onMaxRateChange(e.target.value)}
              error={errors.maxRate || errors.quoteCurrencyCode}
              inputMode="decimal"
              placeholder={rateSwitched ? 'e.g. 0.0012' : 'e.g. 1200'}
            />
            {base && quote ? (
              <p className="text-xs text-text-muted md:col-span-2 lg:col-span-4">
                Enter bounds as {formCurrencyHint}
                {rateSwitched ? ' (will be saved as quote per 1 base).' : '.'}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-4">
              <Button onClick={reviewSave}>{editingId ? 'Review & update' : 'Review & save'}</Button>
              {editingId ? (
                <Button variant="secondary" onClick={clearForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Configured P2P bounds</h3>
            <p className="mt-1 text-xs text-text-secondary">
              {rateSwitched
                ? 'Showing inverted rates (base per 1 quote). Stored values stay quote per 1 base.'
                : 'Showing quote per 1 base (as stored).'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={toggleRateSwitch}
            className={cn('inline-flex items-center gap-2', rateSwitched && 'ring-1 ring-primary')}
            aria-pressed={rateSwitched}
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            Rate Switch
          </Button>
        </div>
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
        title={editingId ? 'Update P2P rate bounds' : 'Save P2P rate bounds'}
        description={`Users posting ${base}/${quote} will only be able to use rates between ${storedForConfirm.minRate || '—'} and ${storedForConfirm.maxRate || '—'} ${quote} per 1 ${base}${
          rateSwitched
            ? ` (entered as ${minRate || '—'}–${maxRate || '—'} ${base} per 1 ${quote}).`
            : '.'
        }`}
        confirmLabel={editingId ? 'Update bounds' : 'Save bounds'}
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
