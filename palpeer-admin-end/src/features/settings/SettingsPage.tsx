import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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

const SETTINGS_PATH = '/admin/settings';
const SECURITY_TAB_PATH = `${SETTINGS_PATH}?tab=security`;

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
  // Legacy MFA gate / bookmarks used #security; prefer query tab when both present.
  if (raw && TAB_IDS.has(raw)) return raw as SettingsTab;
  if (hash === '#security') return 'security';
  return 'general';
}

export function SettingsPage() {
  const { can, mfaEnrollmentRequired } = useAuth();
  const { mode, setMode, resolved } = useTheme();
  const canManage = can('admin:manage');
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = useMemo(
    () => parseTab(searchParams.get('tab'), location.hash),
    [searchParams, location.hash],
  );

  const visibleTabs = TABS.filter((t) => !t.manageOnly || canManage);

  const goToTab = (next: SettingsTab) => {
    if (next === 'general') {
      navigate(SETTINGS_PATH, { replace: true });
      return;
    }
    navigate(`${SETTINGS_PATH}?tab=${next}`, { replace: true });
  };

  useEffect(() => {
    if (!canManage && tab !== 'general' && tab !== 'security') {
      navigate(SETTINGS_PATH, { replace: true });
    }
  }, [canManage, tab, navigate]);

  // Legacy #security bookmarks and MFA gate → canonical ?tab=security (clears hash).
  useEffect(() => {
    if (location.hash !== '#security') return;
    navigate(SECURITY_TAB_PATH, { replace: true });
  }, [location.hash, navigate]);

  useEffect(() => {
    if (!mfaEnrollmentRequired) return;
    if (tab === 'security') return;
    navigate(SECURITY_TAB_PATH, { replace: true });
  }, [mfaEnrollmentRequired, tab, navigate]);

  const selectTab = (next: SettingsTab) => {
    if (mfaEnrollmentRequired && next !== 'security') return;
    goToTab(next);
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

      {tab === 'security' ? <SecuritySettings /> : null}

      {tab === 'general' ? (
        <>
          <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" aria-hidden />
                  <h3 className="text-base font-semibold text-text-primary">Account security</h3>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  Password, active sessions, and authenticator MFA live on the Security tab.
                </p>
              </div>
              <Button type="button" size="sm" onClick={() => selectTab('security')}>
                Open Security
              </Button>
            </div>
          </section>

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
