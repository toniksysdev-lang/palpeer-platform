import { jsonDecimal, parseJson, stringifyJson } from '../json';

describe('lossless JSON', () => {
  it('keeps BigDecimal money fields as exact strings', () => {
    const parsed = parseJson<{ data: { availableBalance: string; amount: string; rate: string } }>(
      '{"data":{"availableBalance":1500.000000000000,"amount":1.0E+3,"rate":0.000650000000}}',
    );
    expect(parsed.data.availableBalance).toBe('1500.000000000000');
    expect(parsed.data.amount).toBe('1.0E+3');
    expect(parsed.data.rate).toBe('0.000650000000');
  });

  it('converts non-money numbers to JS numbers', () => {
    const parsed = parseJson<{ page: number; size: number; precision: number }>(
      '{"page":0,"size":20,"precision":2}',
    );
    expect(parsed).toEqual({ page: 0, size: 20, precision: 2 });
  });

  it('serialises decimals as JSON numbers without float conversion', () => {
    expect(stringifyJson({ amount: jsonDecimal('0.1000000000000000055') })).toBe(
      '{"amount":0.1000000000000000055}',
    );
  });
});
