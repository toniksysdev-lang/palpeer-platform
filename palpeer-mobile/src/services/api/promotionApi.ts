import type { SpringPage } from '@/types/api/common';
import type {
  ApplyReferralRequest,
  BonusResponse,
  PromotionResponse,
  ReferralResponse,
} from '@/types/api/promotion';

import { baseApi } from './baseApi';

export const BONUSES_PAGE_SIZE = 20;

const MY_CODE = { type: 'Referral' as const, id: 'MY_CODE' };
const MY_REFERRALS = { type: 'Referral' as const, id: 'MINE' };
const BONUSES = { type: 'Bonus' as const, id: 'MINE' };

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
      invalidatesTags: (_result, error) => (error ? [] : [BONUSES, MY_REFERRALS, MY_CODE]),
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
  }),
});

export const {
  useGetActivePromotionsQuery,
  useGetMyReferralCodeQuery,
  useGetMyReferralsQuery,
  useApplyReferralMutation,
  useGetMyBonusesInfiniteQuery,
} = promotionApi;
