import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/app/providers/ToastProvider';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { listAdmins } from '@/services/api/admins';
import {
  listPoolFundThresholds,
  upsertPoolFundThreshold,
} from '@/services/api/platformSettings';
import { formatDecimal } from '@/lib/format';
import type { PoolFundThreshold } from '@/types/platformSettings';

function draftKey(row: PoolFundThreshold) {
  return `${row.provider}|${row.currencyCode}`;
}

export function PoolFundThresholdSettings() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const thresholdsQuery = useQuery({
    queryKey: ['admin', 'settings', 'pool-fund-thresholds'],
    queryFn: listPoolFundThresholds,
  });
  const adminsQuery = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: listAdmins,
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [thresholdAmount, setThresholdAmount] = useState('');
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const [phonesText, setPhonesText] = useState('');

  const rows = thresholdsQuery.data ?? [];
  const selected = useMemo(
    () => rows.find((row) => draftKey(row) === selectedKey) ?? rows[0] ?? null,
    [rows, selectedKey],
  );

  useEffect(() => {
    if (!selected) return;
    setSelectedKey(draftKey(selected));
    setThresholdAmount(
      selected.thresholdAmount == null ? '' : String(selected.thresholdAmount),
    );
    setSelectedAdminIds([...(selected.notifyAdminUserIds ?? [])]);
    setPhonesText((selected.notifyPhones ?? []).join(', '));
  }, [selected?.provider, selected?.currencyCode, selected?.updatedAt]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a pool fund');
      const amount = Number(thresholdAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Enter a valid threshold amount');
      }
      const phones = phonesText
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      return upsertPoolFundThreshold({
        provider: selected.provider,
        currencyCode: selected.currencyCode,
        thresholdAmount: amount,
        notifyAdminUserIds: selectedAdminIds,
        notifyPhones: phones,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'settings', 'pool-fund-thresholds'],
      });
      push({ tone: 'success', title: 'Pool fund threshold saved' });
    },
    onError: (err: Error) =>
      push({
        tone: 'error',
        title: 'Could not save threshold',
        description: err.message,
      }),
  });

  const toggleAdmin = (userId: string) => {
    setSelectedAdminIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  if (thresholdsQuery.isError) {
    return (
      <ErrorState
        description="Could not load pool fund thresholds."
        onRetry={() => thresholdsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">
            Pool Fund Balance Threshold Notice
          </h3>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Set a balance floor per pool. When the live (or booked) balance falls to or below the
          threshold after a withdrawal, selected admins are emailed (SMTP/SendPulse) and listed phone
          numbers receive an SMS via the configured SMS provider (Telnyx, Twilio, or BulkSMS).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2 rounded-[0.6rem] border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Available pool funds
          </p>
          {thresholdsQuery.isLoading ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : (
            rows.map((row) => {
              const key = draftKey(row);
              const active = selected != null && draftKey(selected) === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`flex w-full items-start justify-between gap-2 rounded-[0.5rem] border px-3 py-2 text-left ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-surface-secondary'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {row.provider} · {row.currencyCode}
                    </p>
                    <p className="font-mono text-xs text-text-secondary">
                      Balance {formatDecimal(row.currentBalance, 2)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {row.thresholdHit ? <Badge tone="danger">Below threshold</Badge> : null}
                    {row.thresholdAmount != null && !row.thresholdHit ? (
                      <Badge tone="info">
                        Threshold {formatDecimal(row.thresholdAmount, 2)}
                      </Badge>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-4 rounded-[0.6rem] border border-border p-4">
          {!selected ? (
            <p className="text-sm text-text-secondary">Select a pool fund to configure.</p>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {selected.provider} ({selected.currencyCode})
                </p>
                <p className="mt-1 font-mono text-xs text-text-secondary">
                  Current {formatDecimal(selected.currentBalance, 2)} {selected.currencyCode}
                </p>
              </div>

              <Input
                label="Threshold amount"
                type="number"
                min={0}
                step="0.01"
                value={thresholdAmount}
                onChange={(e) => setThresholdAmount(e.target.value)}
                placeholder="e.g. 50000"
              />

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Admin users to email
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-[0.5rem] border border-border p-2">
                  {(adminsQuery.data ?? [])
                    .filter((a) => a.enabled)
                    .map((admin) => {
                      const checked = selectedAdminIds.includes(admin.userId);
                      return (
                        <label
                          key={admin.userId}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAdmin(admin.userId)}
                          />
                          <span className="text-text-primary">
                            {admin.email || admin.userId}
                          </span>
                        </label>
                      );
                    })}
                  {adminsQuery.isLoading ? (
                    <p className="px-2 text-xs text-text-secondary">Loading admins…</p>
                  ) : null}
                </div>
              </div>

              <Input
                label="Phone numbers for SMS (comma-separated)"
                value={phonesText}
                onChange={(e) => setPhonesText(e.target.value)}
                placeholder="+15551234567, +2348012345678"
              />

              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                {saveMutation.isPending ? 'Saving…' : 'Save threshold'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
