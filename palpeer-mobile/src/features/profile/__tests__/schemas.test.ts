import {
  defaultDateOfBirthDisplay,
  personalInfoSchema,
  profileToFormDefaults,
  toDisplayDate,
  toIsoDate,
  toUpdateProfileRequest,
} from '../schemas';

describe('personal info date helpers', () => {
  it('converts dd/mm/yyyy to ISO', () => {
    expect(toIsoDate('21/04/1990')).toBe('1990-04-21');
    expect(toDisplayDate('1990-04-21')).toBe('21/04/1990');
  });

  it('defaults an empty profile DOB to 18 years before today', () => {
    const today = new Date(2026, 9, 17);
    expect(defaultDateOfBirthDisplay(18, today)).toBe('17/10/2008');
    expect(profileToFormDefaults(null).dateOfBirth).toBe(defaultDateOfBirthDisplay(18));
  });

  it('rejects dates of birth under 18', () => {
    const parsed = personalInfoSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '10/12/2015',
      countryOfResidence: 'CA',
      stateTerritory: 'ON',
      addressLine1: '1 King St',
      addressLine2: '',
      city: 'Toronto',
      postalCode: 'M5H 1A1',
      sourceOfIncome: 'EMPLOYMENT',
      monthlyTransactionEstimate: '0_2000',
    });
    expect(parsed.success).toBe(false);
  });

  it('validates a complete form', () => {
    const parsed = personalInfoSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '10/12/1990',
      countryOfResidence: 'CA',
      stateTerritory: 'ON',
      addressLine1: '1 King St',
      addressLine2: '',
      city: 'Toronto',
      postalCode: 'M5H 1A1',
      sourceOfIncome: 'EMPLOYMENT',
      monthlyTransactionEstimate: '0_2000',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const body = toUpdateProfileRequest(parsed.data);
      expect(body.dateOfBirth).toBe('1990-12-10');
      expect(body.addressLine2).toBeNull();
    }
  });
});
