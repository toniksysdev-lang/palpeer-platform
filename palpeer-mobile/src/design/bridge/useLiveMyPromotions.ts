import { useCallback, useMemo } from 'react';
import { router, type Href } from 'expo-router';

import { promotionPeriod, promotionTypeLabel } from '@/features/promotions/logic';
import { useGetActivePromotionsQuery } from '@/services/api/promotionApi';
import { useAppSelector } from '@/store';

/** Live props for design MyPromotions screen. */
export function useLiveMyPromotions() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const promotionsQ = useGetActivePromotionsQuery(undefined, { skip: !authenticated });

  const items = useMemo(() => {
    return (promotionsQ.data ?? []).map((promo) => {
      const period = promotionPeriod(promo);
      return {
        title: promo.title,
        code: promo.code,
        description: promo.description,
        typeLabel: promotionTypeLabel(promo.promotionType),
        windowText: period ?? '',
        isInvite: promo.promotionType === 'REFERRAL',
      };
    });
  }, [promotionsQ.data]);

  const onInvite = useCallback(() => {
    router.push('/InviteFriends' as Href);
  }, []);

  return {
    backend: true as const,
    items,
    onInvite,
  };
}
