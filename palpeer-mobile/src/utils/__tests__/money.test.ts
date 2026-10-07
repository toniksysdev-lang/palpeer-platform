import {
  compareMoney,
  formatMoney,
  formatRate,
  isMoneyString,
  isPositiveMoney,
  toMoney,
} from '../money';

describe('money', () => {
  it('accepts backend decimal forms, including scientific notation', () => {
    expect(isMoneyString('1500.000000000000')).toBe(true);
    expect(isMoneyString('1.5E+3')).toBe(true);
    expect(isMoneyString('-0.25')).toBe(true);
    expect(isMoneyString('12abc')).toBe(false);
    expect(isMoneyString('')).toBe(false);
  });

  it('normalises to a plain decimal string without float drift', () => {
    expect(toMoney('1.5E+3')).toBe('1500');
    expect(toMoney('0.100000000000')).toBe('0.1');
    expect(() => toMoney('abc')).toThrow('Invalid decimal amount');
  });

  it('formats with grouping, precision and currency', () => {
    expect(formatMoney('1234567.891', { currencyCode: 'NGN' })).toBe('1,234,567.89 NGN');
    expect(formatMoney('1000', { precision: 0, currencyCode: 'USD' })).toBe('1,000 USD');
    expect(formatMoney('-50.5', { showCurrency: false })).toBe('-50.50');
    expect(formatMoney('20', { signDisplay: 'always' })).toBe('+20.00');
    expect(formatMoney('0', { signDisplay: 'always' })).toBe('0.00');
  });

  it('rounds half-even for display', () => {
    expect(formatMoney('0.125')).toBe('0.12');
    expect(formatMoney('0.135')).toBe('0.14');
  });

  it('keeps precision that floats would lose', () => {
    expect(formatMoney('9007199254740993.01')).toBe('9,007,199,254,740,993.01');
    expect(formatRate('1532.123456789')).toBe('1532.123457');
  });

  it('compares and validates amounts', () => {
    expect(compareMoney('10.00', '9.99')).toBe(1);
    expect(compareMoney('1e1', '10')).toBe(0);
    expect(isPositiveMoney('0.01')).toBe(true);
    expect(isPositiveMoney('0')).toBe(false);
    expect(isPositiveMoney('x')).toBe(false);
  });
});
