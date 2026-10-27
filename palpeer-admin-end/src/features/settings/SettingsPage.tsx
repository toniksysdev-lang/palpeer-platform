import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  BellRing,
  Globe2,
  KeyRound,
  Monitor,
  Moon,
  Settings,
  Shield,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTheme } from '@/app/providers/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { PinPolicySettings } from '@/features/settings/PinPolicySettings';
import { PoolFundThresholdSettings } from '@/features/settings/PoolFundThresholdSettings';
import { RegistrationCountriesSettings } from '@/features/settings/RegistrationCountriesSettings';
import { FundingUnverifiedLimitSettings } from '@/features/settings/FundingUnverifiedLimitSettings';
import { WithdrawalUnverifiedLimitSettings } from '@/features/settings/WithdrawalUnverifiedLimitSettings';
import { SecuritySettings } from '@/features/settings/SecuritySettings';
import type { ThemeMode } from '@/lib/theme';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

type SettingsTab =
  | 'general'
  | 'security'
  | 'pool-threshold'
  | 'registration-countries'
  | 'pin-policy'
  | 'unverified-withdraw'
  | 'unverified-fund';

const TABS: { id: SettingsTab; label: string; icon: typeof Settings; manageOnly?: boolean }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'security', label: 'Security', icon: Shield },
  {
    id: 'pool-threshold',
    label: 'Pool Fund Balance Threshold Notice',
    icon: BellRing,
    manageOnly: true,
  },
  {
    id: 'registration-countries',
    label: 'Registration countries',
    icon: Globe2,
    manageOnly: true,
  },
  {
    id: 'unverified-withdraw',
    label: 'Withdraw without Identity Verification',
    icon: ShieldAlert,
    manageOnly: true,
  },
  {
    id: 'unverified-fund',
    label: 'Wallet Fund without Identity Verification',
    icon: ShieldAlert,
    manageOnly: true,
  },
  { id: 'pin-policy', label: 'PIN lockout', icon: KeyRound, manageOnly: true },
];

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

function parseTab(raw: string | null, hash: string): SettingsTab {
  if (hash === '#security') return 'security';
  if (raw && TAB_IDS.has(raw)) return raw as SettingsTab;
  return 'general';
}

export function SettingsPage() {
  const { can, mfaEnrollmentRequired } = useAuth();
  const { mode, setMode, resolved } = useTheme();
  const canManage = can('admin:manage');
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(
    () => parseTab(searchParams.get('tab'), location.hash),
    [searchParams, location.hash],
  );

  const visibleTabs = TABS.filter((t) => !t.manageOnly || canManage);

  useEffect(() => {
    if (!canManage && tab !== 'general' && tab !== 'security') {
      setSearchParams({}, { replace: true });
    }
  }, [canManage, tab, setSearchParams]);

  // MFA enrollment gate lands on /admin/settings#security — open the Security tab and scroll.
  useEffect(() => {
    if (location.hash !== '#security') return;
    if (searchParams.get('tab') !== 'security') {
      setSearchParams({ tab: 'security' }, { replace: true });
    }
    const el = document.getElementById('security');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, searchParams, setSearchParams]);

  useEffect(() => {
    if (!mfaEnrollmentRequired) return;
    if (tab === 'security') return;
    setSearchParams({ tab: 'security' }, { replace: true });
  }, [mfaEnrollmentRequired, tab, setSearchParams]);

  const selectTab = (next: SettingsTab) => {
    if (mfaEnrollmentRequired && next !== 'security') return;
    if (next === 'general') {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab: next }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Account security (MFA), platform preferences, registration countries, pool-fund
              alerts, unverified withdraw/fund limits, and PIN lockout policy.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const locked = mfaEnrollmentRequired && item.id !== 'security';
            return (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={active ? 'primary' : 'secondary'}
                aria-pressed={active}
                disabled={locked}
                onClick={() => selectTab(item.id)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </Button>
            );
          })}
        </div>
      </section>

      {tab === 'general' || tab === 'security' ? <SecuritySettings /> : null}

      {tab === 'general' ? (
        <>
          <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
            <h3 className="text-base font-semibold text-text-primary">Appearance</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Theme preference is stored locally on this device. Resolved mode: {resolved}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = mode === option.value;
                return (
                  <Button
                    key={option.value}
                    variant={active ? 'primary' : 'secondary'}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => setMode(option.value)}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </section>

          {canManage ? (
            <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
              <h3 className="text-base font-semibold text-text-primary">Access control</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Manage operators, roles, and the permission catalog from dedicated modules.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/admin/admins"
                  className="rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
                >
                  Admins
                </Link>
                <Link
                  to="/admin/roles"
                  className="rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
                >
                  Roles
                </Link>
                <Link
                  to="/admin/permissions"
                  className="rounded-[0.6rem] border border-border px-3 py-2 text-sm text-primary hover:bg-surface-secondary"
                >
                  Permissions
                </Link>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === 'pool-threshold' && canManage ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <PoolFundThresholdSettings />
        </section>
      ) : null}

      {tab === 'registration-countries' && canManage ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <RegistrationCountriesSettings />
        </section>
      ) : null}

      {tab === 'unverified-withdraw' && canManage ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <WithdrawalUnverifiedLimitSettings />
        </section>
      ) : null}

      {tab === 'unverified-fund' && canManage ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <FundingUnverifiedLimitSettings />
        </section>
      ) : null}

      {tab === 'pin-policy' && canManage ? (
        <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
          <PinPolicySettings />
        </section>
      ) : null}
    </div>
  );
}
