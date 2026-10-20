import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/app/providers/ToastProvider';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  listFundingUnverifiedLimits,
  upsertFundingUnverifiedLimit,
} from '@/services/api/platformSettings';
import { formatDecimal } from '@/lib/format';
import type { FundingUnverifiedLimit } from '@/types/platformSettings';

export function FundingUnverifiedLimitSettings() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const limitsQuery = useQuery({
    queryKey: ['admin', 'settings', 'funding-unverified-limits'],
    queryFn: listFundingUnverifiedLimits,
  });

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [maxAmount, setMaxAmount] = useState('');

  const rows = limitsQuery.data ?? [];
  const selected = useMemo(
    () => rows.find((row) => row.currencyCode === selectedCode) ?? rows[0] ?? null,
    [rows, selectedCode],
  );

  useEffect(() => {
    if (!selected) return;
    setSelectedCode(selected.currencyCode);
    setMaxAmount(selected.maxAmount == null ? '' : String(selected.maxAmount));
  }, [selected?.currencyCode, selected?.updatedAt, selected?.maxAmount]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a wallet currency');
      const amount = Number(maxAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Enter a valid amount (0 or greater)');
      }
      return upsertFundingUnverifiedLimit({
        currencyCode: selected.currencyCode,
        maxAmount: amount,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'settings', 'funding-unverified-limits'],
      });
      push({ tone: 'success', title: 'Unverified funding limit saved' });
    },
    onError: (err: Error) =>
      push({
        tone: 'error',
        title: 'Could not save limit',
        description: err.message,
      }),
  });

  if (limitsQuery.isError) {
    return (
      <ErrorState
        description="Could not load unverified funding limits."
        onRetry={() => limitsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">
            Wallet Fund without Identity Verification
          </h3>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Per wallet currency, set the lifetime amount a user may fund before completing identity
          verification (KYC). Verified users are not limited by this setting. Leave unset for no
          unverified ceiling on that currency.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-2 rounded-[0.6rem] border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Wallet currencies
          </p>
          {limitsQuery.isLoading ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-text-secondary">No currencies configured yet.</p>
          ) : (
            rows.map((row: FundingUnverifiedLimit) => {
              const active = selected?.currencyCode === row.currencyCode;
              return (
                <button
                  key={row.currencyCode}
                  type="button"
                  onClick={() => setSelectedCode(row.currencyCode)}
                  className={`flex w-full items-center justify-between gap-2 rounded-[0.5rem] border px-3 py-2 text-left ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-surface-secondary'
                  }`}
                >
                  <span className="text-sm font-medium text-text-primary">{row.currencyCode}</span>
                  {row.maxAmount != null ? (
                    <Badge tone="info">{formatDecimal(row.maxAmount, 2)}</Badge>
                  ) : (
                    <Badge tone="neutral">Not set</Badge>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-4 rounded-[0.6rem] border border-border p-4">
          {!selected ? (
            <p className="text-sm text-text-secondary">Select a wallet currency.</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-text-primary">
                {selected.currencyCode} wallet
              </p>
              <Input
                label="Amount without identity verification"
                type="number"
                min={0}
                step="0.01"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="e.g. 500"
              />
              <p className="text-xs text-text-muted">
                Includes successful and in-flight funding for that currency. Set 0 to require KYC for
                any wallet fund.
              </p>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                {saveMutation.isPending ? 'Saving…' : 'Save limit'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
