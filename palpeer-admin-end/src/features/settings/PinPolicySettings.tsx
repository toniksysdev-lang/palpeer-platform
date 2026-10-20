import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/app/providers/ToastProvider';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getPinPolicy, updatePinPolicy } from '@/services/api/platformSettings';
import { ApiClientError } from '@/types/api';

export function PinPolicySettings() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const policyQuery = useQuery({
    queryKey: ['admin', 'settings', 'pin-policy'],
    queryFn: getPinPolicy,
  });

  const [maxWrongAttempts, setMaxWrongAttempts] = useState('5');
  const [lockoutHours, setLockoutHours] = useState('0.25');

  useEffect(() => {
    if (!policyQuery.data) return;
    setMaxWrongAttempts(String(policyQuery.data.maxWrongAttempts));
    setLockoutHours(String(policyQuery.data.lockoutHours));
  }, [policyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const attempts = Number(maxWrongAttempts);
      const hours = Number(lockoutHours);
      if (!Number.isInteger(attempts) || attempts < 1 || attempts > 50) {
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'No of PIN entries must be 1–50.');
      }
      if (!Number.isFinite(hours) || hours <= 0 || hours > 720) {
        throw new ApiClientError(400, 'VALIDATION_FAILED', 'Hours must be greater than 0 and at most 720.');
      }
      return updatePinPolicy({ maxWrongAttempts: attempts, lockoutHours: hours });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'pin-policy'] });
      push({ tone: 'success', title: 'PIN policy saved' });
    },
    onError: (err: Error) =>
      push({
        tone: 'error',
        title: 'Could not save PIN policy',
        description: err.message,
      }),
  });

  if (policyQuery.isError) {
    return (
      <ErrorState
        description="Could not load PIN policy."
        onRetry={() => policyQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">PIN entry lockout</h3>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          After this many wrong transaction-PIN entries, PIN entry is disabled for the hours below.
          Forgot-PIN security answers use the same limits on a separate counter, so a wrong answer
          does not burn a PIN attempt. A correct PIN or a successful PIN reset clears that channel.
        </p>
      </div>

      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Input
          label="No of PIN entries"
          type="number"
          min={1}
          max={50}
          step={1}
          value={maxWrongAttempts}
          onChange={(e) => setMaxWrongAttempts(e.target.value)}
        />
        <Input
          label="Hours (lockout duration)"
          type="number"
          min={0.01}
          max={720}
          step={0.01}
          value={lockoutHours}
          onChange={(e) => setLockoutHours(e.target.value)}
        />
      </div>
      <p className="text-xs text-text-muted">
        Example: 5 entries and 0.25 hours locks the PIN for 15 minutes after 5 wrong attempts.
      </p>

      <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Save className="h-3.5 w-3.5" aria-hidden />
        {saveMutation.isPending ? 'Saving…' : 'Save PIN policy'}
      </Button>
    </div>
  );
}
