import { ApiClientError } from '@/types/api';
import type { CurrencySummary } from '@/types/admin';
import type { CreateCurrencyInput, CreateExchangeRateInput, ExchangeRate } from '@/types/rates';

const currencies: CurrencySummary[] = [
  { id: 'c-cad', code: 'CAD', symbol: 'C$', precision: 2 },
  { id: 'c-ngn', code: 'NGN', symbol: '₦', precision: 2 },
  { id: 'c-usd', code: 'USD', symbol: '$', precision: 2 },
];

const rates: ExchangeRate[] = [
  {
    id: 'r-1',
    baseCurrencyCode: 'CAD',
    quoteCurrencyCode: 'NGN',
    buyRate: '1048.50',
    sellRate: '1052.00',
    effectiveDate: new Date(Date.now() - 86400000).toISOString(),
    channel: 'SWAP',
    active: true,
    approvalStatus: 'APPROVED',
  },
  {
    id: 'r-2',
    baseCurrencyCode: 'CAD',
    quoteCurrencyCode: 'NGN',
    buyRate: '1045.00',
    sellRate: '1049.25',
    effectiveDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    channel: 'SWAP',
    active: true,
    approvalStatus: 'APPROVED',
  },
  {
    id: 'r-3',
    baseCurrencyCode: 'USD',
    quoteCurrencyCode: 'CAD',
    buyRate: '1.35',
    sellRate: '1.37',
    effectiveDate: new Date(Date.now() - 3600000).toISOString(),
    channel: 'SWAP',
    active: true,
    approvalStatus: 'APPROVED',
  },
  {
    id: 'r-4',
    baseCurrencyCode: 'CAD',
    quoteCurrencyCode: 'NGN',
    buyRate: '1030.00',
    sellRate: '1035.00',
    effectiveDate: new Date(Date.now() - 7200000).toISOString(),
    channel: 'P2P',
    active: true,
    approvalStatus: 'APPROVED',
  },
];

export function mockListCurrencies(): CurrencySummary[] {
  return currencies.map((row) => ({ ...row }));
}

export function mockCreateCurrency(input: CreateCurrencyInput): CurrencySummary {
  const code = input.code.trim().toUpperCase();
  if (currencies.some((row) => row.code === code)) {
    throw new ApiClientError(409, 'CURRENCY_EXISTS', 'Currency already exists.');
  }
  const created: CurrencySummary = {
    id: `c-${code.toLowerCase()}`,
    code,
    symbol: input.symbol.trim(),
    precision: input.precision,
  };
  currencies.push(created);
  return { ...created };
}

export function mockLatestRate(base: string, quote: string): ExchangeRate {
  const matched = rates
    .filter(
      (row) =>
        row.baseCurrencyCode === base.toUpperCase() &&
        row.quoteCurrencyCode === quote.toUpperCase(),
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  if (!matched[0]) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'No rate found for pair.');
  }
  return { ...matched[0] };
}

export function mockRateHistory(base: string, quote: string): ExchangeRate[] {
  return rates
    .filter(
      (row) =>
        row.baseCurrencyCode === base.toUpperCase() &&
        row.quoteCurrencyCode === quote.toUpperCase(),
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
    .map((row) => ({ ...row }));
}

export function mockLatestRates(): ExchangeRate[] {
  const now = new Date().toISOString();
  const latest = new Map<string, ExchangeRate>();
  for (const row of rates) {
    if (row.effectiveDate > now) continue;
    const key = `${row.baseCurrencyCode}/${row.quoteCurrencyCode}`;
    const current = latest.get(key);
    if (!current || row.effectiveDate > current.effectiveDate) {
      latest.set(key, row);
    }
  }
  return [...latest.values()]
    .sort(
      (a, b) =>
        a.baseCurrencyCode.localeCompare(b.baseCurrencyCode) ||
        a.quoteCurrencyCode.localeCompare(b.quoteCurrencyCode),
    )
    .map((row) => ({ ...row }));
}

export function mockPublishRate(input: CreateExchangeRateInput): ExchangeRate {
  const buy = Number(input.buyRate);
  const sell = Number(input.sellRate);
  if (!(buy > 0) || !(sell > 0)) {
    throw new ApiClientError(400, 'VALIDATION_FAILED', 'Rates must be greater than zero.');
  }
  const created: ExchangeRate = {
    id: `r-${Date.now()}`,
    baseCurrencyCode: input.baseCurrencyCode.trim().toUpperCase(),
    quoteCurrencyCode: input.quoteCurrencyCode.trim().toUpperCase(),
    buyRate: input.buyRate,
    sellRate: input.sellRate,
    effectiveDate: input.effectiveDate,
    channel: input.channel ?? 'SWAP',
    active: true,
    approvalStatus: input.submitForApproval ? 'PENDING' : 'APPROVED',
  };
  rates.unshift(created);
  return { ...created };
}
