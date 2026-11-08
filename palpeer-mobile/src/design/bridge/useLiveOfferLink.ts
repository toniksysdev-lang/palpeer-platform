import { useMemo } from 'react';

import { useGetPublicP2PRequestQuery } from '@/services/api/currencyApi';
import { formatMoney, formatRate } from '@/utils/money';

/**
 * Guest offer deep-link artboard. Pass `requestId` as a static route prop when known.
 */
export function useLiveOfferLink(requestId?: string) {
  const id = requestId?.trim() || '';
  const q = useGetPublicP2PRequestQuery(id, { skip: !id });

  const live = useMemo(() => {
    const r = q.data;
    if (!r) {
      return {
        backend: true as const,
        headline: 'Someone shared an offer with you',
        totalLabel: '—',
        rateLabel: '—',
        ready: false,
      };
    }
    const sellingCad = r.baseCurrencyCode === 'CAD';
    const amt = formatMoney(r.amount, {
      precision: sellingCad ? 2 : 0,
      showCurrency: false,
    });
    const headline = sellingCad
      ? `A person is selling CA$${amt}`
      : `A person is selling ₦${amt}`;
    const totalNgn =
      sellingCad && r.rate
        ? `At ₦${formatMoney(
            String(Number.parseFloat(r.amount) * Number.parseFloat(r.rate) || 0),
            { precision: 0, showCurrency: false },
          )}`
        : `At ${r.quoteCurrencyCode} ${formatMoney(r.amount, { precision: 0, showCurrency: false })}`;
    return {
      backend: true as const,
      headline,
      totalLabel: totalNgn,
      rateLabel: `CA$1 = ₦${formatRate(r.rate, 0)}`,
      ready: true,
      requestId: r.id,
    };
  }, [q.data]);

  return live;
}
