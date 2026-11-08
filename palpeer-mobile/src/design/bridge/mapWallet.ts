import type { CurrencyResponse, WalletResponse } from '@/types/api/wallet';

import { DESIGN_CURRENCY_META, metaFor, type DesignCurrencyMeta } from './currencyMeta';

/** Shape design screens expect for a wallet row / picker option. */
export type DesignWallet = DesignCurrencyMeta & {
  id?: string;
  bal: number;
};

export function balanceNumber(available: string | null | undefined): number {
  const n = Number.parseFloat(available ?? '0');
  return Number.isFinite(n) ? n : 0;
}

export function mapApiWallet(wallet: WalletResponse): DesignWallet {
  const meta = metaFor(wallet.currencyCode);
  return {
    ...meta,
    id: wallet.id,
    bal: balanceNumber(wallet.availableBalance),
    on: true,
    dec: meta.dec,
  };
}

/**
 * Full catalog for home "add wallet": every known currency, with live balance when owned.
 * Currencies returned by the API are `on: true`; design-only extras stay `on: false`.
 */
export function buildWalletCatalog(
  apiWallets: WalletResponse[] | undefined,
  currencies: CurrencyResponse[] | undefined,
): DesignWallet[] {
  const byCode = new Map((apiWallets ?? []).map((w) => [w.currencyCode, w]));
  const apiCodes = new Set((currencies ?? []).map((c) => c.code));
  const codes = new Set<string>([
    ...Object.keys(DESIGN_CURRENCY_META),
    ...apiCodes,
    ...byCode.keys(),
  ]);

  return [...codes].map((code) => {
    const owned = byCode.get(code);
    const currency = currencies?.find((c) => c.code === code);
    const meta = metaFor(code);
    return {
      ...meta,
      id: owned?.id,
      bal: owned ? balanceNumber(owned.availableBalance) : 0,
      on: apiCodes.size === 0 ? meta.on : apiCodes.has(code),
      dec: currency?.precision ?? meta.dec,
      sym: currency?.symbol ? currency.symbol : meta.sym,
    };
  });
}

export function ownedDesignWallets(apiWallets: WalletResponse[] | undefined): DesignWallet[] {
  return (apiWallets ?? []).map(mapApiWallet);
}
