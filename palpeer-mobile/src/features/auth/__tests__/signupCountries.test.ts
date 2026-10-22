import { formatNationalPhone, iso2FromE164, toE164 } from '../signupCountries';

describe('formatNationalPhone', () => {
  it('formats CA/US progressively as (XXX) XXX-XXXX', () => {
    expect(formatNationalPhone('5', 'CA')).toBe('5');
    expect(formatNationalPhone('506', 'CA')).toBe('506');
    expect(formatNationalPhone('5062', 'CA')).toBe('(506) 2');
    expect(formatNationalPhone('506210', 'US')).toBe('(506) 210');
    expect(formatNationalPhone('5062100661', 'CA')).toBe('(506) 210-0661');
  });

  it('groups other corridors with spaces', () => {
    expect(formatNationalPhone('801', 'NG')).toBe('801');
    expect(formatNationalPhone('801234', 'NG')).toBe('801 234');
    expect(formatNationalPhone('8012345678', 'NG')).toBe('801 234 5678');
  });

  it('strips non-digits before formatting', () => {
    expect(formatNationalPhone('(506) 210-0661', 'CA')).toBe('(506) 210-0661');
  });
});

describe('toE164', () => {
  it('joins dial code with national digits only', () => {
    expect(toE164('+1', '(506) 210-0661')).toBe('+15062100661');
  });
});

describe('iso2FromE164', () => {
  it('matches corridor dial codes', () => {
    expect(iso2FromE164('+2348012345678')).toBe('NG');
    expect(iso2FromE164('+447911123456')).toBe('GB');
    expect(iso2FromE164('+233201234567')).toBe('GH');
  });

  it('prefers corridor countries when dial codes collide', () => {
    expect(iso2FromE164('+15062100661')).toBe('CA');
  });

  it('returns null for short or empty input', () => {
    expect(iso2FromE164(null)).toBeNull();
    expect(iso2FromE164('+234')).toBeNull();
  });
});
