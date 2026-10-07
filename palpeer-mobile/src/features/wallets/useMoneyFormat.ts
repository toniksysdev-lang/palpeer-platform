import { Decimal } from 'decimal.js-light';
import { useCallback } from 'react';

import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import type { CurrencyResponse } from '@/types/api/wallet';
import { formatMoney, type FormatMoneyOptions } from '@/utils/money';

type Options = Omit<FormatMoneyOptions, 'currencyCode' | 'precision'>;

export function precisionFor(
  currencies: readonly CurrencyResponse[] | undefined,
  currencyCode: string,
): number | undefined {
  return currencies?.find((currency) => currency.code === currencyCode)?.precision;
}

/**
 * Formats an amount with its currency's `precision` from `GET /currencies`. Until the currency list
 * is known the exact backend value is shown (at least 2 decimals) instead of rounding to a guess.
 */
export function formatAmount(
  amount: string,
  currencyCode: string,
  currencies: readonly CurrencyResponse[] | undefined,
  options: Options = {},
): string {
  const precision =
    precisionFor(currencies, currencyCode) ?? Math.max(2, new Decimal(amount).decimalPlaces());
  return formatMoney(amount, { ...options, currencyCode, precision });
}

export function useMoneyFormat() {
  const { data: currencies } = useGetCurrenciesQuery();
  const format = useCallback(
    (amount: string, currencyCode: string, options?: Options) =>
      formatAmount(amount, currencyCode, currencies, options),
    [currencies],
  );
  const precision = useCallback(
    (currencyCode: string) => precisionFor(currencies, currencyCode),
    [currencies],
  );
  return { format, precision, currencies };
}
