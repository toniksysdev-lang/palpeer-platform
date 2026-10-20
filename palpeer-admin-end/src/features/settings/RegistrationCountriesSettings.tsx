import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/app/providers/ToastProvider';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { countryFlag, countryName, WORLD_COUNTRIES } from '@/lib/worldCountries';
import {
  getRegistrationCountries,
  updateRegistrationCountries,
} from '@/services/api/platformSettings';

export function RegistrationCountriesSettings() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'settings', 'registration-countries'],
    queryFn: getRegistrationCountries,
  });

  const [configured, setConfigured] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [addIso2, setAddIso2] = useState('');

  useEffect(() => {
    if (!query.data) return;
    const nextConfigured = [
      ...(query.data.configuredIso2 ?? query.data.supportedIso2 ?? []),
    ];
    setConfigured(nextConfigured);
    setEnabled([...(query.data.enabledIso2 ?? [])]);
  }, [
    query.data?.configuredIso2?.join('|'),
    query.data?.supportedIso2?.join('|'),
    query.data?.enabledIso2?.join('|'),
  ]);

  const addableCountries = useMemo(
    () => WORLD_COUNTRIES.filter((c) => !configured.includes(c.iso2)),
    [configured],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      updateRegistrationCountries({
        configuredIso2: configured,
        enabledIso2: enabled,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'settings', 'registration-countries'],
      });
      push({ tone: 'success', title: 'Registration countries updated' });
    },
    onError: (err: Error) =>
      push({
        tone: 'error',
        title: 'Could not save countries',
        description: err.message,
      }),
  });

  const toggle = (iso2: string) => {
    setEnabled((prev) =>
      prev.includes(iso2) ? prev.filter((c) => c !== iso2) : [...prev, iso2],
    );
  };

  const addCountry = () => {
    if (!addIso2) return;
    const code = addIso2.toUpperCase();
    setConfigured((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setEnabled((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setAddIso2('');
  };

  const removeCountry = (iso2: string) => {
    setConfigured((prev) => prev.filter((c) => c !== iso2));
    setEnabled((prev) => prev.filter((c) => c !== iso2));
  };

  if (query.isError) {
    return (
      <ErrorState
        description="Could not load registration countries."
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-text-primary">
            Mobile registration countries
          </h3>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Add countries that can appear in the mobile app, then enable or disable each one for new
          user registration. At least one country must stay enabled.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-[0.6rem] border border-border bg-surface-secondary/30 p-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Select
            label="Add country"
            value={addIso2}
            onChange={(e) => setAddIso2(e.target.value)}
          >
            <option value="">Select a country…</option>
            {addableCountries.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.flag} {c.name} ({c.iso2})
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={addCountry} disabled={!addIso2}>
          <Plus className="h-4 w-4" aria-hidden />
          Add country
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {configured.map((iso2) => {
          const name = countryName(iso2);
          const flag = countryFlag(iso2);
          const on = enabled.includes(iso2);
          return (
            <div
              key={iso2}
              className="flex items-center gap-3 rounded-[0.6rem] border border-border px-3 py-3"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                  checked={on}
                  onChange={() => toggle(iso2)}
                />
                <span className="text-2xl leading-none" aria-hidden>
                  {flag}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">{name}</span>
                  <span className="text-xs text-text-muted">{iso2}</span>
                </span>
              </label>
              <Badge tone={on ? 'primary' : 'neutral'}>{on ? 'Enabled' : 'Disabled'}</Badge>
              <button
                type="button"
                className="rounded p-1.5 text-text-muted hover:bg-surface-secondary hover:text-danger"
                aria-label={`Remove ${name}`}
                onClick={() => removeCountry(iso2)}
                disabled={configured.length <= 1}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || enabled.length === 0 || configured.length === 0}
      >
        <Save className="h-4 w-4" aria-hidden />
        {saveMutation.isPending ? 'Saving…' : 'Save countries'}
      </Button>
    </div>
  );
}
