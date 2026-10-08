import { apiRequest } from '@/services/api/client';
import type { CurrencySummary } from '@/types/admin';
import type { CreateCurrencyInput, CreateExchangeRateInput, ExchangeRate } from '@/types/rates';

export async function listCurrencies(): Promise<CurrencySummary[]> {
  return apiRequest<CurrencySummary[]>('/currencies');
}

export async function getCurrency(code: string): Promise<CurrencySummary> {
  return apiRequest<CurrencySummary>(`/currencies/${encodeURIComponent(code)}`);
}

/** Prefer admin surface for writes. */
export async function createCurrency(input: CreateCurrencyInput): Promise<CurrencySummary> {
  return apiRequest<CurrencySummary>('/admin/currencies', {
    method: 'POST',
    body: {
      code: input.code.trim().toUpperCase(),
      symbol: input.symbol.trim(),
      precision: input.precision,
    },
  });
}

export async function getLatestExchangeRate(params: {
  base: string;
  quote: string;
  asOf?: string;
}): Promise<ExchangeRate> {
  const search = new URLSearchParams({
    base: params.base.trim().toUpperCase(),
    quote: params.quote.trim().toUpperCase(),
  });
  if (params.asOf) {
    search.set('asOf', params.asOf);
  }
  return apiRequest<ExchangeRate>(`/exchange-rates/latest?${search.toString()}`);
}

export async function listExchangeRateHistory(params: {
  base: string;
  quote: string;
}): Promise<ExchangeRate[]> {
  const search = new URLSearchParams({
    base: params.base.trim().toUpperCase(),
    quote: params.quote.trim().toUpperCase(),
  });
  return apiRequest<ExchangeRate[]>(`/exchange-rates?${search.toString()}`);
}

export async function listLatestExchangeRates(channel?: string): Promise<ExchangeRate[]> {
  const search = new URLSearchParams();
  if (channel) search.set('channel', channel);
  const qs = search.toString();
  return apiRequest<ExchangeRate[]>(`/admin/rates/latest${qs ? `?${qs}` : ''}`);
}

/** Prefer admin surface for publishes. */
export async function publishExchangeRate(input: CreateExchangeRateInput): Promise<ExchangeRate> {
  return apiRequest<ExchangeRate>('/admin/rates', {
    method: 'POST',
    body: {
      baseCurrencyCode: input.baseCurrencyCode.trim().toUpperCase(),
      quoteCurrencyCode: input.quoteCurrencyCode.trim().toUpperCase(),
      buyRate: input.buyRate,
      sellRate: input.sellRate,
      effectiveDate: input.effectiveDate,
      channel: input.channel ?? 'SWAP',
      submitForApproval: Boolean(input.submitForApproval),
    },
  });
}

export async function setExchangeRateActive(id: string, active: boolean): Promise<ExchangeRate> {
  return apiRequest<ExchangeRate>(
    `/admin/rates/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`,
    { method: 'POST' },
  );
}

export async function setExchangeRateApproval(
  id: string,
  decision: 'approve' | 'reject',
): Promise<ExchangeRate> {
  return apiRequest<ExchangeRate>(`/admin/rates/${encodeURIComponent(id)}/${decision}`, {
    method: 'POST',
  });
}

/** Hard-deletes the pair (all rate rows for that base/quote/channel). */
export async function deleteExchangeRatePair(id: string): Promise<void> {
  await apiRequest<null>(`/admin/rates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
