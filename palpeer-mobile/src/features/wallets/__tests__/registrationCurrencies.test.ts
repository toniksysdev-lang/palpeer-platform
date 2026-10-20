import {
  countryIso2ForCurrency,
  currencyCodesForRegistrationCountries,
  filterCurrenciesByRegistrationCountries,
  remainingRegistrationWalletOptions,
} from '../registrationCurrencies';

describe('registrationCurrencies', () => {
  it('maps enabled registration countries to unique currency codes', () => {
    expect(currencyCodesForRegistrationCountries(['CA', 'NG', 'ca', 'US'])).toEqual([
      'CAD',
      'NGN',
      'USD',
    ]);
  });

  it('filters platform currencies to the registration corridor', () => {
    const currencies = [
      { code: 'CAD' },
      { code: 'NGN' },
      { code: 'USD' },
      { code: 'XYZ' },
    ];
    expect(filterCurrenciesByRegistrationCountries(currencies, ['NG', 'GB'])).toEqual([
      { code: 'NGN' },
    ]);
    expect(filterCurrenciesByRegistrationCountries(currencies, ['ZZ'])).toEqual([]);
  });

  it('maps currency codes to flag countries', () => {
    expect(countryIso2ForCurrency('CAD')).toBe('CA');
    expect(countryIso2ForCurrency('ngn')).toBe('NG');
    expect(countryIso2ForCurrency('EUR')).toBe('EU');
    expect(countryIso2ForCurrency('XYZ')).toBeNull();
  });

  it('lists remaining registration countries not already held', () => {
    expect(
      remainingRegistrationWalletOptions({
        registrationIso2: ['CA', 'US', 'NG', 'GB'],
        platformCurrencyCodes: ['CAD', 'USD', 'NGN'],
        heldCurrencyCodes: ['CAD'],
      }).map((option) => option.countryIso2),
    ).toEqual(['US', 'NG', 'GB']);
  });

  it('keeps enabled countries whose currency is not on the platform (not creatable)', () => {
    const options = remainingRegistrationWalletOptions({
      registrationIso2: ['CA', 'GH', 'KE'],
      platformCurrencyCodes: ['CAD'],
      heldCurrencyCodes: [],
    });
    expect(options.map((option) => option.countryIso2)).toEqual(['CA', 'GH', 'KE']);
    expect(options.find((option) => option.countryIso2 === 'CA')?.creatable).toBe(true);
    expect(options.find((option) => option.countryIso2 === 'GH')?.creatable).toBe(false);
    expect(options.find((option) => option.countryIso2 === 'KE')?.creatable).toBe(false);
  });
});
