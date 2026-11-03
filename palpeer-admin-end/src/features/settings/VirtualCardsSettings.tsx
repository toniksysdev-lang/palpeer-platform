import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/app/providers/ToastProvider';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getVirtualCardsSetting, updateVirtualCardsSetting } from '@/services/api/platformSettings';

export function VirtualCardsSettings() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'settings', 'virtual-cards'],
    queryFn: getVirtualCardsSetting,
  });

  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (query.data) setEnabled(query.data.enabled);
  }, [query.data?.enabled]);

  const saveMutation = useMutation({
    mutationFn: () => updateVirtualCardsSetting({ enabled }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'settings', 'virtual-cards'],
      });
      push({
        tone: 'success',
        title: data.enabled ? 'Virtual cards enabled' : 'Virtual cards disabled',
        description: data.enabled
          ? 'Mobile users can issue and manage cards.'
          : 'Mobile shows “This is coming” on the Cards tab.',
      });
    },
    onError: (err: Error) =>
      push({
        tone: 'error',
        title: 'Could not save virtual cards setting',
        description: err.message,
      }),
  });

  if (query.isError) {
    return (
      <ErrorState
        description="Could not load virtual cards setting."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const dirty = query.data ? query.data.enabled !== enabled : false;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">Virtual cards</h3>
          {query.data ? (
            <Badge tone={query.data.enabled ? 'success' : 'warning'}>
              {query.data.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          When disabled, the mobile app Cards experience shows “This is coming” and new card
          issuance is blocked on the API.
        </p>
      </div>

      <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-[0.6rem] border border-border bg-surface-secondary/40 px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
          checked={enabled}
          disabled={query.isLoading || saveMutation.isPending}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-text-primary">Enable virtual cards</span>
          <span className="mt-0.5 block text-xs text-text-muted">
            Applies immediately to the mobile app (no app store release required).
          </span>
        </span>
      </label>

      <div>
        <Button
          type="button"
          size="sm"
          disabled={!dirty || saveMutation.isPending || query.isLoading}
          onClick={() => saveMutation.mutate()}
        >
          <Save className="h-3.5 w-3.5" aria-hidden />
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
