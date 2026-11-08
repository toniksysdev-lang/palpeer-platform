import type { SpringPage } from '@/types/api/common';
import type {
  ApplyReferralRequest,
  BonusCurrencySummary,
  BonusResponse,
  LoyaltyPointsBalance,
  LoyaltyPointsLedgerEntry,
  PromotionResponse,
  ReferralResponse,
} from '@/types/api/promotion';

import { baseApi } from './baseApi';

export const BONUSES_PAGE_SIZE = 20;
export const POINTS_PAGE_SIZE = 20;

const MY_CODE = { type: 'Referral' as const, id: 'MY_CODE' };
const MY_REFERRALS = { type: 'Referral' as const, id: 'MINE' };
const BONUSES = { type: 'Bonus' as const, id: 'MINE' };
const POINTS = { type: 'Bonus' as const, id: 'POINTS' };

function withoutLedgerId(raw: BonusResponse & { ledgerEntryId?: unknown }): BonusResponse {
  const { ledgerEntryId: _ledger, ...bonus } = raw;
  return bonus;
}

export const promotionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getActivePromotions: build.query<PromotionResponse[], void>({
      query: () => ({ path: '/promotions/active' }),
      providesTags: [{ type: 'Promotion', id: 'ACTIVE' }],
    }),
    /** POST, but it only creates a code when the caller has no unused one (read-like). */
    getMyReferralCode: build.query<ReferralResponse, void>({
      query: () => ({ path: '/promotions/referrals/my-code', method: 'POST' }),
      providesTags: [MY_CODE],
    }),
    getMyReferrals: build.query<ReferralResponse[], void>({
      query: () => ({ path: '/promotions/referrals/mine' }),
      providesTags: [MY_REFERRALS],
    }),
    applyReferral: build.mutation<ReferralResponse, ApplyReferralRequest>({
      query: (body) => ({ path: '/promotions/referrals/apply', method: 'POST', body }),
      invalidatesTags: (_result, error) =>
        error
          ? []
          : [BONUSES, POINTS, MY_REFERRALS, MY_CODE, { type: 'Wallet' as const, id: 'LIST' }],
    }),
    getMyBonuses: build.infiniteQuery<SpringPage<BonusResponse>, void, number>({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
      },
      query: ({ pageParam }) => ({
        path: '/promotions/bonuses/mine',
        query: { page: pageParam, size: BONUSES_PAGE_SIZE },
      }),
      transformResponse: (page: SpringPage<BonusResponse>) => ({
        ...page,
        content: page.content.map(withoutLedgerId),
      }),
      providesTags: [BONUSES],
    }),
    getMyBonusSummary: build.query<BonusCurrencySummary[], void>({
      query: () => ({ path: '/promotions/bonuses/mine/summary' }),
      transformResponse: (rows: unknown): BonusCurrencySummary[] => {
        if (!Array.isArray(rows)) return [];
        return rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            currencyCode: String(r.currencyCode ?? '').trim().toUpperCase(),
            totalAmount: String(r.totalAmount ?? '0'),
            unusedAmount: String(r.unusedAmount ?? '0'),
            usedAmount: String(r.usedAmount ?? '0'),
          } as BonusCurrencySummary;
        });
      },
      providesTags: [BONUSES],
    }),
    getMyLoyaltyPointsBalance: build.query<LoyaltyPointsBalance, void>({
      query: () => ({ path: '/promotions/points/mine/balance' }),
      transformResponse: (raw: unknown): LoyaltyPointsBalance => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return {
          balancePoints: Number(r.balancePoints ?? 0) || 0,
          balanceCad: String(r.balanceCad ?? '0'),
          earnedPoints: Number(r.earnedPoints ?? 0) || 0,
          usedPoints: Number(r.usedPoints ?? 0) || 0,
          pointsPerCad: Number(r.pointsPerCad ?? 100) || 100,
          currencyCode: String(r.currencyCode ?? 'CAD').trim().toUpperCase() || 'CAD',
        };
      },
      providesTags: [POINTS, BONUSES],
    }),
    getMyLoyaltyPointsLedger: build.infiniteQuery<
      SpringPage<LoyaltyPointsLedgerEntry>,
      void,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
      },
      query: ({ pageParam }) => ({
        path: '/promotions/points/mine',
        query: { page: pageParam, size: POINTS_PAGE_SIZE },
      }),
      providesTags: [POINTS, BONUSES],
    }),
  }),
  overrideExisting: process.env.NODE_ENV !== 'production',
});

export const {
  useGetActivePromotionsQuery,
  useGetMyReferralCodeQuery,
  useGetMyReferralsQuery,
  useApplyReferralMutation,
  useGetMyBonusesInfiniteQuery,
  useGetMyBonusSummaryQuery,
  useGetMyLoyaltyPointsBalanceQuery,
  useGetMyLoyaltyPointsLedgerInfiniteQuery,
} = promotionApi;
