import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Gift, Search } from 'lucide-react';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Drawer } from '@/components/dialogs/Drawer';
import { ErrorState } from '@/components/feedback/ErrorState';
import { DataTable, type DataColumn } from '@/components/tables/DataTable';
import { Pagination } from '@/components/tables/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { appConfig } from '@/config/env';
import { useToast } from '@/app/providers/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDecimal } from '@/lib/format';
import {
  mockGetAdminReferral,
  mockListAdminBonuses,
  mockListAdminReferrals,
} from '@/mocks/promotions';
import {
  getAdminReferral,
  listAdminBonuses,
  listAdminReferrals,
  settleAdminBonus,
} from '@/services/api/promotions';
import { ApiClientError } from '@/types/api';
import {
  BONUS_STATUSES,
  REFERRAL_STATUSES,
  type BonusStatus,
  type BonusSummary,
  type ReferralStatus,
  type ReferralSummary,
} from '@/types/promotions';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'COMPLETED':
    case 'GRANTED':
      return 'success';
    case 'OPEN':
    case 'PENDING':
      return 'warning';
    case 'CANCELLED':
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function shortId(value?: string | null): string {
  if (!value) return '—';
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function UserIdLink({
  userId,
  canRead,
  short = false,
}: {
  userId?: string | null;
  canRead: boolean;
  short?: boolean;
}) {
  if (!userId) return <span className="font-mono text-[11px]">—</span>;
  const label = short ? shortId(userId) : userId;
  if (!canRead) return <span className="font-mono text-[11px] break-all">{label}</span>;
  return (
    <Link
      to={`/admin/users/${userId}`}
      className="font-mono text-[11px] text-primary hover:underline break-all"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}

export function ReferralsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const canUsers = can('users:read');
  const allowed = can('promotions:write');
  const [settleTarget, setSettleTarget] = useState<BonusSummary | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') === 'bonuses' ? 'bonuses' : 'referrals';
  const status = (searchParams.get('status') ?? '') as ReferralStatus | BonusStatus | '';
  const referralCode = searchParams.get('code') ?? '';
  const referrerUserId = searchParams.get('referrer') ?? '';
  const refereeUserId = searchParams.get('referee') ?? '';
  const userId = searchParams.get('userId') ?? '';
  const referralId = searchParams.get('referralId') ?? '';
  const page = Number(searchParams.get('page') ?? '0') || 0;
  const size = Number(searchParams.get('size') ?? '20') || 20;

  const [statusDraft, setStatusDraft] = useState(status);
  const [codeDraft, setCodeDraft] = useState(referralCode);
  const [referrerDraft, setReferrerDraft] = useState(referrerUserId);
  const [refereeDraft, setRefereeDraft] = useState(refereeUserId);
  const [userIdDraft, setUserIdDraft] = useState(userId);
  const [referralIdDraft, setReferralIdDraft] = useState(referralId);
  const [selected, setSelected] = useState<ReferralSummary | null>(null);

  useEffect(() => {
    setStatusDraft(status);
    setCodeDraft(referralCode);
    setReferrerDraft(referrerUserId);
    setRefereeDraft(refereeUserId);
    setUserIdDraft(userId);
    setReferralIdDraft(referralId);
  }, [status, referralCode, referrerUserId, refereeUserId, userId, referralId]);

  const referralsQuery = useQuery({
    queryKey: [
      'admin-referrals',
      status,
      referralCode,
      referrerUserId,
      refereeUserId,
      page,
      size,
      appConfig.useMockApi,
    ],
    enabled: allowed && tab === 'referrals',
    queryFn: async () => {
      const params = {
        status: (status || undefined) as ReferralStatus | undefined,
        referralCode: referralCode || undefined,
        referrerUserId: referrerUserId || undefined,
        refereeUserId: refereeUserId || undefined,
        page,
        size,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockListAdminReferrals(params);
      }
      return listAdminReferrals(params);
    },
  });

  const bonusesQuery = useQuery({
    queryKey: ['admin-bonuses', status, userId, referralId, page, size, appConfig.useMockApi],
    enabled: allowed && tab === 'bonuses',
    queryFn: async () => {
      const params = {
        status: (status || undefined) as BonusStatus | undefined,
        userId: userId || undefined,
        referralId: referralId || undefined,
        page,
        size,
      };
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        return mockListAdminBonuses(params);
      }
      return listAdminBonuses(params);
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (bonusId: string) => {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return { id: bonusId, status: 'GRANTED' } as BonusSummary;
      }
      return settleAdminBonus(bonusId);
    },
    onSuccess: async () => {
      setSettleTarget(null);
      push({ tone: 'success', title: 'Bonus settled', description: 'Wallet credited via ledger.' });
      await queryClient.invalidateQueries({ queryKey: ['admin-bonuses'] });
    },
    onError: (error) => {
      push({
        tone: 'error',
        title: 'Settlement failed',
        description: error instanceof ApiClientError ? error.message : 'Request failed.',
      });
    },
  });

  const detailQuery = useQuery({
    queryKey: ['admin-referral', selected?.id, appConfig.useMockApi],
    enabled: Boolean(selected?.id),
    queryFn: async () => {
      if (!selected) throw new Error('missing');
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return mockGetAdminReferral(selected.id);
      }
      return getAdminReferral(selected.id);
    },
  });

  function applyFilters() {
    const next = new URLSearchParams();
    next.set('tab', tab);
    if (statusDraft) next.set('status', statusDraft);
    if (tab === 'referrals') {
      if (codeDraft.trim()) next.set('code', codeDraft.trim());
      if (referrerDraft.trim()) next.set('referrer', referrerDraft.trim());
      if (refereeDraft.trim()) next.set('referee', refereeDraft.trim());
    } else {
      if (userIdDraft.trim()) next.set('userId', userIdDraft.trim());
      if (referralIdDraft.trim()) next.set('referralId', referralIdDraft.trim());
    }
    next.set('page', '0');
    next.set('size', String(size));
    setSearchParams(next);
  }

  function setTab(nextTab: 'referrals' | 'bonuses') {
    const next = new URLSearchParams();
    next.set('tab', nextTab);
    next.set('page', '0');
    next.set('size', String(size));
    setStatusDraft('');
    setSearchParams(next);
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  const referralColumns = useMemo<DataColumn<ReferralSummary>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        cell: (row) => <span className="font-mono text-xs">{row.referralCode}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <Badge tone={statusTone(String(row.status))}>{row.status}</Badge>,
      },
      {
        id: 'referrer',
        header: 'Referrer',
        cell: (row) => <UserIdLink userId={row.referrerUserId} canRead={canUsers} short />,
      },
      {
        id: 'referee',
        header: 'Referee',
        cell: (row) => <UserIdLink userId={row.refereeUserId} canRead={canUsers} short />,
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: (row) => <span className="text-xs text-text-muted">{formatDateTime(row.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(row)}>
              Quick view
            </Button>
            <Link
              to={`/admin/referrals/${row.id}`}
              className="inline-flex h-8 items-center rounded-[0.6rem] border border-border px-2.5 text-xs text-primary hover:bg-surface-secondary"
            >
              Open
            </Link>
          </div>
        ),
      },
    ],
    [canUsers],
  );

  const bonusColumns = useMemo<DataColumn<BonusSummary>[]>(
    () => [
      {
        id: 'userId',
        header: 'User',
        cell: (row) => <UserIdLink userId={row.userId} canRead={canUsers} short />,
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: (row) => (
          <span className="text-sm">
            {formatDecimal(row.amount)} {row.currencyCode}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <Badge tone={statusTone(String(row.status))}>{row.status}</Badge>,
      },
      {
        id: 'reason',
        header: 'Reason',
        cell: (row) => <span className="text-sm text-text-secondary">{row.reason || '—'}</span>,
      },
      {
        id: 'referralId',
        header: 'Referral',
        cell: (row) =>
          row.referralId ? (
            <Link
              to={`/admin/referrals/${row.referralId}`}
              className="font-mono text-[11px] text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {shortId(row.referralId)}
            </Link>
          ) : (
            <span className="font-mono text-[11px]">—</span>
          ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: (row) => <span className="text-xs text-text-muted">{formatDateTime(row.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) =>
          row.status === 'PENDING' ? (
            <Button variant="secondary" size="sm" onClick={() => setSettleTarget(row)}>
              Settle
            </Button>
          ) : null,
      },
    ],
    [canUsers],
  );

  if (!allowed) {
    return (
      <ErrorState
        title="Permission required"
        description="promotions:write is required to view referral and bonus inventory."
      />
    );
  }

  const detail = detailQuery.data ?? selected;

  return (
    <div className="space-y-5">
      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-text-primary">Referrals</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Referrals and bonuses across all users. Settle PENDING bonuses to credit the user wallet
              via the ledger. Campaign formulas and eligibility live under{' '}
              <Link to="/admin/promotions" className="text-primary hover:underline">
                Promotions
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={tab === 'referrals' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setTab('referrals')}
          >
            Referrals
          </Button>
          <Button
            variant={tab === 'bonuses' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setTab('bonuses')}
          >
            Bonuses
          </Button>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Status"
            value={statusDraft}
            onChange={(event) => setStatusDraft(event.target.value as typeof statusDraft)}
          >
            <option value="">All</option>
            {(tab === 'referrals' ? REFERRAL_STATUSES : BONUS_STATUSES).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          {tab === 'referrals' ? (
            <>
              <Input
                label="Referral code"
                value={codeDraft}
                onChange={(event) => setCodeDraft(event.target.value)}
                placeholder="REF…"
              />
              <Input
                label="Referrer user ID"
                value={referrerDraft}
                onChange={(event) => setReferrerDraft(event.target.value)}
                placeholder="UUID"
              />
              <Input
                label="Referee user ID"
                value={refereeDraft}
                onChange={(event) => setRefereeDraft(event.target.value)}
                placeholder="UUID"
              />
            </>
          ) : (
            <>
              <Input
                label="User ID"
                value={userIdDraft}
                onChange={(event) => setUserIdDraft(event.target.value)}
                placeholder="UUID"
              />
              <Input
                label="Referral ID"
                value={referralIdDraft}
                onChange={(event) => setReferralIdDraft(event.target.value)}
                placeholder="UUID"
              />
            </>
          )}
          <Button onClick={applyFilters}>
            <Search className="h-3.5 w-3.5" aria-hidden />
            Apply
          </Button>
        </div>
      </section>

      <section className="rounded-[0.6rem] border border-border bg-surface p-5 shadow-card">
        {tab === 'referrals' ? (
          referralsQuery.isError ? (
            <ErrorState
              description={
                referralsQuery.error instanceof ApiClientError
                  ? referralsQuery.error.message
                  : 'Failed to load referrals.'
              }
              onRetry={() => void referralsQuery.refetch()}
            />
          ) : (
            <>
              <DataTable
                columns={referralColumns}
                rows={referralsQuery.data?.content ?? []}
                rowKey={(row) => row.id}
                loading={referralsQuery.isLoading}
                emptyTitle="No referrals"
                emptyDescription="Referral codes appear here when users create or apply them."
              />
              <Pagination
                className="mt-4"
                page={page}
                totalPages={referralsQuery.data?.totalPages ?? 1}
                totalElements={referralsQuery.data?.totalElements ?? 0}
                onPageChange={setPage}
              />
            </>
          )
        ) : bonusesQuery.isError ? (
          <ErrorState
            description={
              bonusesQuery.error instanceof ApiClientError
                ? bonusesQuery.error.message
                : 'Failed to load bonuses.'
            }
            onRetry={() => void bonusesQuery.refetch()}
          />
        ) : (
          <>
            <DataTable
              columns={bonusColumns}
              rows={bonusesQuery.data?.content ?? []}
              rowKey={(row) => row.id}
              loading={bonusesQuery.isLoading}
              emptyTitle="No bonuses"
              emptyDescription="Pending referral bonuses appear after a successful apply when a REFERRAL promotion is active."
            />
            <Pagination
              className="mt-4"
              page={page}
              totalPages={bonusesQuery.data?.totalPages ?? 1}
              totalElements={bonusesQuery.data?.totalElements ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(settleTarget)}
        title="Settle bonus?"
        description={
          settleTarget
            ? `Credit ${formatDecimal(settleTarget.amount)} ${settleTarget.currencyCode} to the user's wallet?`
            : ''
        }
        confirmLabel="Settle bonus"
        tone="primary"
        busy={settleMutation.isPending}
        onClose={() => setSettleTarget(null)}
        onConfirm={() => {
          if (settleTarget) settleMutation.mutate(settleTarget.id);
        }}
      />

      <Drawer
        open={Boolean(selected)}
        title={selected ? `Referral ${selected.referralCode}` : 'Referral'}
        onClose={() => setSelected(null)}
      >
        {detail ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Status</dt>
              <dd>
                <Badge tone={statusTone(String(detail.status))}>{detail.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Code</dt>
              <dd className="font-mono text-xs">{detail.referralCode}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Referrer</dt>
              <dd>
                <UserIdLink userId={detail.referrerUserId} canRead={canUsers} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Referee</dt>
              <dd>
                <UserIdLink userId={detail.refereeUserId} canRead={canUsers} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Promotion</dt>
              <dd className="font-mono text-xs break-all">{detail.promotionId || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Created</dt>
              <dd>{formatDateTime(detail.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">ID</dt>
              <dd className="font-mono text-xs break-all">{detail.id}</dd>
            </div>
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}
