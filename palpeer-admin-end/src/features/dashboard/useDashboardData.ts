import { useQueries } from '@tanstack/react-query';
import { appConfig } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  mockAuditPage,
  mockCurrencies,
  mockKycPage,
  mockP2POrders,
  mockP2PRequests,
  mockUsersPage,
} from '@/mocks/dashboard';
import { searchAuditLogs } from '@/services/api/audit';
import { listCurrencies } from '@/services/api/currencies';
import { listKycCases } from '@/services/api/kyc';
import { listAdminP2POrders, listAdminP2PRequests } from '@/services/api/p2p';
import { listAdminBonuses, listAdminReferrals } from '@/services/api/promotions';
import { getReportsSummary } from '@/services/api/reports';
import { listAdminUsers } from '@/services/api/users';
import { ApiClientError } from '@/types/api';
import type {
  AdminUserSummary,
  AuditLogEntry,
  CurrencySummary,
  KycCaseSummary,
  P2POrderSummary,
  P2PRequestSummary,
  SpringPage,
} from '@/types/admin';
import type { BonusSummary, ReferralSummary } from '@/types/promotions';
import type { AdminReportsSummary } from '@/types/reports';
import { mockListAdminBonuses, mockListAdminReferrals } from '@/mocks/promotions';
import { mockReportsSummary } from '@/mocks/reports';

export type DashboardSlice<T> = {
  status: 'idle' | 'loading' | 'success' | 'error' | 'forbidden' | 'skipped';
  data?: T;
  errorMessage?: string;
};

function toSlice<T>(result: {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  data?: T;
  error: unknown;
  fetchStatus: string;
}): DashboardSlice<T> {
  if (result.isPending) return { status: 'loading' };
  if (result.isError) {
    const err = result.error;
    if (err instanceof ApiClientError && err.status === 403) {
      return { status: 'forbidden', errorMessage: err.message };
    }
    return {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Request failed.',
    };
  }
  if (result.isSuccess) return { status: 'success', data: result.data };
  return { status: 'idle' };
}

async function delay<T>(value: T, ms = 350): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return value;
}

export function useDashboardData() {
  const { can } = useAuth();

  const canUsers = can('users:read');
  const canKyc = can('kyc:read');
  const canP2p = can('p2p:read');
  const canAudit = can('audit:read');
  const canPromotions = can('promotions:write');
  const canReports = can('reports:read');
  // Currency list is authenticated platform API (no admin permission code).
  const canCurrencies = true;

  const results = useQueries({
    queries: [
      {
        queryKey: ['dashboard', 'users', appConfig.useMockApi],
        enabled: canUsers,
        queryFn: () =>
          appConfig.useMockApi ? delay(mockUsersPage) : listAdminUsers({ page: 0, size: 5 }),
      },
      {
        queryKey: ['dashboard', 'kyc', appConfig.useMockApi],
        enabled: canKyc,
        queryFn: () =>
          appConfig.useMockApi ? delay(mockKycPage) : listKycCases({ page: 0, size: 5 }),
      },
      {
        queryKey: ['dashboard', 'p2p-requests', appConfig.useMockApi],
        enabled: canP2p,
        queryFn: () =>
          appConfig.useMockApi ? delay(mockP2PRequests) : listAdminP2PRequests(),
      },
      {
        queryKey: ['dashboard', 'p2p-orders', appConfig.useMockApi],
        enabled: canP2p,
        queryFn: () => (appConfig.useMockApi ? delay(mockP2POrders) : listAdminP2POrders()),
      },
      {
        queryKey: ['dashboard', 'audit', appConfig.useMockApi],
        enabled: canAudit,
        queryFn: () =>
          appConfig.useMockApi ? delay(mockAuditPage) : searchAuditLogs({ page: 0, size: 8 }),
      },
      {
        queryKey: ['dashboard', 'currencies', appConfig.useMockApi],
        enabled: canCurrencies,
        queryFn: () => (appConfig.useMockApi ? delay(mockCurrencies) : listCurrencies()),
      },
      {
        queryKey: ['dashboard', 'referrals', appConfig.useMockApi],
        enabled: canPromotions,
        queryFn: () =>
          appConfig.useMockApi
            ? delay(mockListAdminReferrals({ page: 0, size: 1 }))
            : listAdminReferrals({ page: 0, size: 1 }),
      },
      {
        queryKey: ['dashboard', 'bonuses', appConfig.useMockApi],
        enabled: canPromotions,
        queryFn: () =>
          appConfig.useMockApi
            ? delay(mockListAdminBonuses({ page: 0, size: 1 }))
            : listAdminBonuses({ page: 0, size: 1 }),
      },
      {
        queryKey: ['dashboard', 'reports-summary', appConfig.useMockApi],
        enabled: canReports,
        queryFn: () => (appConfig.useMockApi ? delay(mockReportsSummary()) : getReportsSummary()),
      },
    ],
  });

  const [usersQ, kycQ, requestsQ, ordersQ, auditQ, currenciesQ, referralsQ, bonusesQ, summaryQ] =
    results;

  const users = canUsers
    ? toSlice<SpringPage<AdminUserSummary>>(usersQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing users:read' };
  const kyc = canKyc
    ? toSlice<SpringPage<KycCaseSummary>>(kycQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing kyc:read' };
  const p2pRequests = canP2p
    ? toSlice<P2PRequestSummary[]>(requestsQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing p2p:read' };
  const p2pOrders = canP2p
    ? toSlice<P2POrderSummary[]>(ordersQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing p2p:read' };
  const audit = canAudit
    ? toSlice<SpringPage<AuditLogEntry>>(auditQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing audit:read' };
  const currencies = toSlice<CurrencySummary[]>(currenciesQ);
  const referrals = canPromotions
    ? toSlice<SpringPage<ReferralSummary>>(referralsQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing promotions:write' };
  const bonuses = canPromotions
    ? toSlice<SpringPage<BonusSummary>>(bonusesQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing promotions:write' };
  const summary = canReports
    ? toSlice<AdminReportsSummary>(summaryQ)
    : { status: 'forbidden' as const, errorMessage: 'Missing reports:read' };

  function refetchAll() {
    void Promise.all(results.map((result) => result.refetch()));
  }

  const anyLoading = results.some((result) => result.isPending && result.fetchStatus !== 'idle');
  const anyError = [
    users,
    kyc,
    p2pRequests,
    p2pOrders,
    audit,
    currencies,
    referrals,
    bonuses,
    summary,
  ].some((slice) => slice.status === 'error');

  return {
    users,
    kyc,
    p2pRequests,
    p2pOrders,
    audit,
    currencies,
    referrals,
    bonuses,
    summary,
    refetchAll,
    anyLoading,
    anyError,
  };
}
