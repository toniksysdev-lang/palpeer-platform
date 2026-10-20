import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  mockCreateCurrency,
  mockDeleteRatePair,
  mockLatestRates,
  mockListCurrencies,
  mockPublishRate,
  mockRateHistory,
} from '@/mocks/rates';
import { P2PRateBoundsPanel } from '@/features/rates/P2PRateBoundsPanel';
import {
  createCurrency,
  deleteExchangeRatePair,
  listCurrencies,
  listExchangeRateHistory,
  listLatestExchangeRates,
  publishExchangeRate,
  setExchangeRateActive,
  setExchangeRateApproval,
} from '@/services/api/currencies';
import { ApiClientError } from '@/types/api';
import type { ExchangeRate, RateChannel } from '@/types/rates';

const publishSchema = z.object({
  baseCurrencyCode: z.string().trim().min(3).max(10),
  quoteCurrencyCode: z.string().trim().min(3).max(10),
  buyRate: z.string().trim().refine((value) => Number(value) > 0, 'Buy rate must be > 0'),
  sellRate: z.string().trim().refine((value) => Number(value) > 0, 'Sell rate must be > 0'),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  channel: z.enum(['SWAP', 'P2P']),
  submitForApproval: z.boolean(),
});

const currencySchema = z.object({
  code: z.string().trim().min(3).max(10),
  symbol: z.string().trim().min(1).max(10),
  precision: z.coerce.number().int().min(0).max(18),
});

function toIsoFromLocalInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid effective date');
  }
  return date.toISOString();
}

export function RatesPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreateCurrency = can('currencies:write');
  const canPublishRate = can('rates:write');

  const base = (searchParams.get('base') ?? '').toUpperCase();
  const quote = (searchParams.get('quote') ?? '').toUpperCase();
  const channel = ((searchParams.get('channel') ?? 'SWAP').toUpperCase() === 'P2P'
    ? 'P2P'
    : 'SWAP') as RateChannel;
  const pairSelected = Boolean(base && quote && base !== quote);

  const [buyRate, setBuyRate] = useState('');
  const [sellRate, setSellRate] = useState('');
  const [submitForApproval, setSubmitForApproval] = useState(false);
  const [effectiveLocal, setEffectiveLocal] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});

  const [currencyCode, setCurrencyCode] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [currencyPrecision, setCurrencyPrecision] = useState('2');
  const [currencyConfirmOpen, setCurrencyConfirmOpen] = useState(false);
  const [currencyErrors, setCurrencyErrors] = useState<Record<string, string>>({});
  const [removingPair, setRemovingPair] = useState<ExchangeRate | null>(null);
  const [scrollToPublish, setScrollToPublish] = useState(false);
  const publishSectionRef = useRef<HTMLElement | HTMLDivElement | null>(null);

  function nowLocalInputValue() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  function setChannel(next: RateChannel) {
    const params = new URLSearchParams(searchParams);
    params.set('channel', next);
    setSearchParams(params);
  }

  function setPair(nextBase: string, nextQuote: string) {
    const next = new URLSearchParams(searchParams);
    if (nextBase) next.set('base', nextBase.toUpperCase());
    else next.delete('base');
    if (nextQuote) next.set('quote', nextQuote.toUpperCase());
    else next.delete('quote');
    next.set('channel', channel);
    setSearchParams(next);
  }

  /** Prefill the publish form so the operator can publish an updated rate for the pair. */
  const startEdit = useCallback(
    (row: ExchangeRate) => {
      const next = new URLSearchParams(searchParams);
      next.set('base', row.baseCurrencyCode.toUpperCase());
      next.set('quote', row.quoteCurrencyCode.toUpperCase());
      next.set('channel', channel);
      setSearchParams(next);
      setBuyRate(String(row.buyRate ?? ''));
      setSellRate(String(row.sellRate ?? ''));
      setSubmitForApproval(false);
      setEffectiveLocal(nowLocalInputValue());
      setPublishErrors({});
      setScrollToPublish(true);
    },
    [searchParams, channel, setSearchParams],
  );

  useEffect(() => {
    if (!scrollToPublish || !pairSelected) return;
    publishSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollToPublish(false);
  }, [scrollToPublish, pairSelected, base, quote]);

  const currenciesQuery = useQuery({
    queryKey: ['currencies', appConfig.useMockApi],
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockListCurrencies();
      }
      return listCurrencies();
    },
  });

  const allLatestQuery = useQuery({
    queryKey: ['exchange-rates-all-latest', channel, appConfig.useMockApi],
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockLatestRates().filter((row) => (row.channel ?? 'SWAP') === channel);
      }
      return listLatestExchangeRates(channel);
    },
  });

  /** Admin latest for the selected pair — avoids public /exchange-rates/latest 404 when none published. */
  const latestForPair = useMemo(() => {
    if (!pairSelected) return null;
    return (
      (allLatestQuery.data ?? []).find(
        (row) =>
          row.baseCurrencyCode === base &&
          row.quoteCurrencyCode === quote &&
          (row.channel ?? 'SWAP') === channel,
      ) ?? null
    );
  }, [allLatestQuery.data, base, quote, channel, pairSelected]);

  const historyQuery = useQuery({
    queryKey: ['exchange-rate-history', base, quote, channel, appConfig.useMockApi],
    enabled: pairSelected,
    queryFn: async () => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockRateHistory(base, quote, channel);
      }
      return listExchangeRateHistory({ base, quote, channel });
    },
    retry: false,
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const parsed = publishSchema.safeParse({
        baseCurrencyCode: base,
        quoteCurrencyCode: quote,
        buyRate,
        sellRate,
        effectiveDate: effectiveLocal,
        channel,
        submitForApproval,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          next[key] = issue.message;
        }
        setPublishErrors(next);
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the highlighted fields.');
      }
      setPublishErrors({});
      const payload = {
        ...parsed.data,
        effectiveDate: toIsoFromLocalInput(parsed.data.effectiveDate),
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockPublishRate(payload);
      }
      return publishExchangeRate(payload);
    },
    onSuccess: async (created) => {
      setPublishConfirmOpen(false);
      push({
        tone: 'success',
        title: submitForApproval ? 'Rate submitted for approval' : 'Rate published',
        description: `${created.baseCurrencyCode}/${created.quoteCurrencyCode} (${created.channel ?? channel}).`,
      });
      setBuyRate('');
      setSellRate('');
      setSubmitForApproval(false);
      await queryClient.invalidateQueries({ queryKey: ['exchange-rate-history', base, quote] });
      await queryClient.invalidateQueries({ queryKey: ['exchange-rates-all-latest'] });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.code === 'VALIDATION_FAILED') {
        push({ tone: 'warning', title: 'Validation', description: error.message });
        return;
      }
      push({
        tone: 'error',
        title: 'Rate publish failed',
        description: error instanceof ApiClientError ? error.message : 'The rate could not be published.',
      });
    },
  });

  const currencyMutation = useMutation({
    mutationFn: async () => {
      const parsed = currencySchema.safeParse({
        code: currencyCode,
        symbol: currencySymbol,
        precision: currencyPrecision,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          next[key] = issue.message;
        }
        setCurrencyErrors(next);
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Fix the currency form.');
      }
      setCurrencyErrors({});
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return mockCreateCurrency(parsed.data);
      }
      return createCurrency(parsed.data);
    },
    onSuccess: async (created) => {
      setCurrencyConfirmOpen(false);
      push({
        tone: 'success',
        title: 'Currency created',
        description: `${created.code} is available.`,
      });
      setCurrencyCode('');
      setCurrencySymbol('');
      setCurrencyPrecision('2');
      await queryClient.invalidateQueries({ queryKey: ['currencies'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'currencies'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Currency create failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const historyColumns = useMemo<DataColumn<ExchangeRate>[]>(
    () => [
      {
        id: 'effectiveDate',
        header: 'Effective',
        cell: (row) => formatDateTime(row.effectiveDate),
      },
      {
        id: 'buyRate',
        header: 'Buy',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.buyRate)}</span>,
      },
      {
        id: 'sellRate',
        header: 'Sell',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.sellRate)}</span>,
      },
      {
        id: 'id',
        header: 'Rate id',
        cell: (row) => <span className="font-mono text-[11px] text-text-muted">{row.id}</span>,
      },
    ],
    [],
  );

  const rateActionMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      action: 'activate' | 'deactivate' | 'approve' | 'reject';
    }) => {
      if (input.action === 'activate' || input.action === 'deactivate') {
        return setExchangeRateActive(input.id, input.action === 'activate');
      }
      return setExchangeRateApproval(input.id, input.action);
    },
    onSuccess: async (_data, variables) => {
      push({
        tone: 'success',
        title: `Rate ${variables.action}d`,
      });
      await queryClient.invalidateQueries({ queryKey: ['exchange-rates-all-latest'] });
      await queryClient.invalidateQueries({ queryKey: ['exchange-rate-history'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Rate update failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const deletePairMutation = useMutation({
    mutationFn: async (rate: ExchangeRate) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        mockDeleteRatePair(rate.id);
        return rate;
      }
      await deleteExchangeRatePair(rate.id);
      return rate;
    },
    onSuccess: async (rate) => {
      setRemovingPair(null);
      push({
        tone: 'success',
        title: 'Pair deleted',
        description: `${rate.baseCurrencyCode}/${rate.quoteCurrencyCode} (${rate.channel ?? channel}) removed.`,
      });
      if (rate.baseCurrencyCode === base && rate.quoteCurrencyCode === quote) {
        setPair('', '');
      }
      await queryClient.invalidateQueries({ queryKey: ['exchange-rates-all-latest'] });
      await queryClient.invalidateQueries({ queryKey: ['exchange-rate-history'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Delete failed',
        description: error instanceof ApiClientError ? error.message : 'The pair could not be deleted.',
      });
    },
  });

  const allLatestColumns = useMemo<DataColumn<ExchangeRate>[]>(
    () => [
      {
        id: 'pair',
        header: 'Pair',
        cell: (row) => {
          const selected = row.baseCurrencyCode === base && row.quoteCurrencyCode === quote;
          return (
            <span className="flex items-center gap-2 font-medium text-text-primary">
              {row.baseCurrencyCode}/{row.quoteCurrencyCode}
              {selected ? <Badge tone="primary">Selected</Badge> : null}
            </span>
          );
        },
      },
      {
        id: 'channel',
        header: 'Channel',
        cell: (row) => <Badge tone="info">{row.channel ?? 'SWAP'}</Badge>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <span className="flex flex-wrap gap-1">
            <Badge tone={row.active === false ? 'warning' : 'success'}>
              {row.active === false ? 'Inactive' : 'Active'}
            </Badge>
            <Badge
              tone={
                row.approvalStatus === 'REJECTED'
                  ? 'danger'
                  : row.approvalStatus === 'PENDING'
                    ? 'warning'
                    : 'primary'
              }
            >
              {row.approvalStatus ?? 'APPROVED'}
            </Badge>
          </span>
        ),
      },
      {
        id: 'buyRate',
        header: 'Buy',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.buyRate)}</span>,
      },
      {
        id: 'sellRate',
        header: 'Sell',
        cell: (row) => <span className="font-mono text-xs">{formatDecimal(row.sellRate)}</span>,
      },
      {
        id: 'effectiveDate',
        header: 'Effective',
        cell: (row) => formatDateTime(row.effectiveDate),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (row) =>
          canPublishRate ? (
            <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
              {row.active === false ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => rateActionMutation.mutate({ id: row.id, action: 'activate' })}
                >
                  Activate
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => rateActionMutation.mutate({ id: row.id, action: 'deactivate' })}
                >
                  Deactivate
                </Button>
              )}
              {row.approvalStatus === 'PENDING' ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => rateActionMutation.mutate({ id: row.id, action: 'approve' })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => rateActionMutation.mutate({ id: row.id, action: 'reject' })}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemovingPair(row)}>
                Delete
              </Button>
            </div>
          ) : null,
      },
    ],
    [base, quote, canPublishRate, rateActionMutation, startEdit],
  );

  const currencyOptions = currenciesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Rates & currencies</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Manage InstantEX (swap) published rates and P2P post bounds. On P2P, configure min/max
              rates users may post for each currency pair.
            </p>
          </div>
        </div>
        <div className="mt-4 inline-flex rounded-[0.6rem] border border-border bg-surface-secondary/40 p-1">
          {(
            [
              { value: 'SWAP', label: 'InstantEX / Swap' },
              { value: 'P2P', label: 'P2P rates' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setChannel(tab.value)}
              className={cn(
                'rounded-[0.45rem] px-3 py-1.5 text-sm font-medium transition-colors',
                channel === tab.value
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">
          All {channel === 'P2P' ? 'P2P' : 'swap'} pairs (latest)
        </h3>
        <p className="mt-1 mb-4 text-sm text-text-secondary">
          Latest rate per pair for this channel. Edit pre-fills buy/sell to publish an updated rate.
          Activate/deactivate, approve pending rates, or delete a pair (removes all history for that
          base/quote/channel). Click a row to open the pair viewer.
        </p>
        <DataTable
          columns={allLatestColumns}
          rows={allLatestQuery.data ?? []}
          rowKey={(row) => `${row.baseCurrencyCode}/${row.quoteCurrencyCode}`}
          loading={allLatestQuery.isLoading}
          error={
            allLatestQuery.error instanceof ApiClientError
              ? allLatestQuery.error.message
              : allLatestQuery.error
                ? 'Failed to load latest rates.'
                : null
          }
          onRetry={() => void allLatestQuery.refetch()}
          emptyTitle="No rates published"
          emptyDescription="Publish a rate for a pair to see it here."
          onRowClick={(row) => setPair(row.baseCurrencyCode, row.quoteCurrencyCode)}
        />
      </section>

      {channel !== 'P2P' ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-text-primary">Pair lookup</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Pick a currency pair to see its latest rate and history.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Base"
              value={base}
              onChange={(event) => setPair(event.target.value, quote)}
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
              onChange={(event) => setPair(base, event.target.value)}
            >
              <option value="">Select quote</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </Select>
          </div>
          {!pairSelected ? (
            <p className="mt-3 text-xs text-text-muted">
              Choose two different currencies to load rates.
            </p>
          ) : null}
        </section>
      ) : null}

      {channel === 'P2P' ? <P2PRateBoundsPanel /> : null}

      {channel !== 'P2P' && pairSelected ? (
        <>
          <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
            <h3 className="text-base font-semibold text-text-primary">
              Latest {base}/{quote}
            </h3>
            {allLatestQuery.isLoading ? <Skeleton className="mt-4 h-20 w-full" /> : null}
            {allLatestQuery.isError ? (
              <div className="mt-4">
                <ErrorState
                  description={
                    allLatestQuery.error instanceof ApiClientError
                      ? allLatestQuery.error.message
                      : 'Failed to load latest rate.'
                  }
                  onRetry={() => void allLatestQuery.refetch()}
                />
              </div>
            ) : null}
            {!allLatestQuery.isLoading && !allLatestQuery.isError && !latestForPair ? (
              <div className="mt-4">
                <EmptyState
                  title="No rate for this pair"
                  description={`Publish a ${channel} rate for ${base}/${quote} below to populate this section.`}
                />
              </div>
            ) : null}
            {latestForPair ? (
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-text-muted">Buy rate</dt>
                  <dd className="mt-1 font-mono text-2xl font-semibold text-text-primary">
                    {formatDecimal(latestForPair.buyRate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Sell rate</dt>
                  <dd className="mt-1 font-mono text-2xl font-semibold text-text-primary">
                    {formatDecimal(latestForPair.sellRate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Effective</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    {formatDateTime(latestForPair.effectiveDate)}
                  </dd>
                </div>
              </dl>
            ) : null}
          </section>

          <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
            <h3 className="mb-4 text-base font-semibold text-text-primary">Rate history</h3>
            <DataTable
              columns={historyColumns}
              rows={historyQuery.data ?? []}
              rowKey={(row) => row.id}
              loading={historyQuery.isLoading}
              error={
                historyQuery.error instanceof ApiClientError
                  ? historyQuery.error.message
                  : historyQuery.error
                    ? 'Failed to load history.'
                    : null
              }
              onRetry={() => void historyQuery.refetch()}
              emptyTitle="No history for pair"
              emptyDescription="Publish a rate for this pair to populate history."
            />
          </section>

          <section
            ref={publishSectionRef}
            className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card"
          >
            <h3 className="text-base font-semibold text-text-primary">
              {latestForPair ? `Edit / publish ${base}/{quote}` : 'Publish swap rate'}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Set a new buy and sell rate for this pair on the InstantEX channel. Both rates must be
              greater than 0. Publishing creates a new effective rate (history is preserved).
            </p>
            {!canPublishRate ? (
              <div className="mt-4">
                <ErrorState
                  title="Permission required"
                  description="rates:write is required to publish exchange rates."
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                  label="Buy rate"
                  value={buyRate}
                  onChange={(event) => setBuyRate(event.target.value)}
                  error={publishErrors.buyRate}
                  inputMode="decimal"
                  placeholder="e.g. 1.2500"
                />
                <Input
                  label="Sell rate"
                  value={sellRate}
                  onChange={(event) => setSellRate(event.target.value)}
                  error={publishErrors.sellRate}
                  inputMode="decimal"
                  placeholder="e.g. 1.2400"
                />
                <Input
                  label="Effective date/time"
                  type="datetime-local"
                  value={effectiveLocal}
                  onChange={(event) => setEffectiveLocal(event.target.value)}
                  error={publishErrors.effectiveDate}
                />
                <label className="flex items-end gap-2 pb-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                    checked={submitForApproval}
                    onChange={(event) => setSubmitForApproval(event.target.checked)}
                  />
                  Submit for approval (pending until approved)
                </label>
                <div className="flex items-end md:col-span-2">
                  <Button onClick={() => setPublishConfirmOpen(true)}>Review & publish</Button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-semibold text-text-primary">Create currency</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Add a new currency that can be used in rates and wallets.
        </p>
        {!canCreateCurrency ? (
          <div className="mt-4">
            <ErrorState
              title="Permission required"
              description="currencies:write is required to create currencies."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input
              label="Code"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
              error={currencyErrors.code}
              placeholder="CAD"
            />
            <Input
              label="Symbol"
              value={currencySymbol}
              onChange={(event) => setCurrencySymbol(event.target.value)}
              error={currencyErrors.symbol}
              placeholder="C$"
            />
            <Input
              label="Precision"
              type="number"
              min={0}
              max={18}
              value={currencyPrecision}
              onChange={(event) => setCurrencyPrecision(event.target.value)}
              error={currencyErrors.precision}
            />
            <div className="md:col-span-3">
              <Button onClick={() => setCurrencyConfirmOpen(true)}>Review & create</Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={publishConfirmOpen}
        title="Publish exchange rate"
        description={`Publish ${base}/${quote} on ${channel} with buy=${buyRate || '—'} sell=${sellRate || '—'} effective ${effectiveLocal}${submitForApproval ? ' (pending approval)' : ' (auto-approved)'}?`}
        confirmLabel={submitForApproval ? 'Submit for approval' : 'Publish rate'}
        tone="primary"
        busy={publishMutation.isPending}
        onClose={() => setPublishConfirmOpen(false)}
        onConfirm={() => publishMutation.mutate()}
      />

      <ConfirmDialog
        open={currencyConfirmOpen}
        title="Create currency"
        description={`Create ${currencyCode || '—'} (${currencySymbol || '—'}) with precision ${currencyPrecision}?`}
        confirmLabel="Create currency"
        tone="primary"
        busy={currencyMutation.isPending}
        onClose={() => setCurrencyConfirmOpen(false)}
        onConfirm={() => currencyMutation.mutate()}
      />

      <ConfirmDialog
        open={Boolean(removingPair)}
        title="Delete rate pair"
        description={
          removingPair
            ? `Permanently delete ${removingPair.baseCurrencyCode}/${removingPair.quoteCurrencyCode} on ${removingPair.channel ?? channel}? This removes every rate row for that pair and channel.`
            : ''
        }
        confirmLabel="Delete pair"
        tone="danger"
        busy={deletePairMutation.isPending}
        onClose={() => setRemovingPair(null)}
        onConfirm={() => removingPair && deletePairMutation.mutate(removingPair)}
      />
    </div>
  );
}
