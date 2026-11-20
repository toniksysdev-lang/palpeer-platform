import { postalCodeForProfile } from '../useLiveSecurity';

describe('postalCodeForProfile', () => {
  it('keeps a provided postal code', () => {
    expect(postalCodeForProfile('CA', ' M5H 1A1 ')).toBe('M5H 1A1');
  });

  it('uses N/A when postal is optional for the country', () => {
    expect(postalCodeForProfile('NG', '')).toBe('N/A');
    expect(postalCodeForProfile('GH', '  ')).toBe('N/A');
    expect(postalCodeForProfile('KE', '')).toBe('N/A');
  });

  it('returns empty when postal is required and missing', () => {
    expect(postalCodeForProfile('CA', '')).toBe('');
    expect(postalCodeForProfile('US', '')).toBe('');
  });
});
