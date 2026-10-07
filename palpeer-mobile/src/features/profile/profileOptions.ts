import type { PickerOption } from '@/features/exchange/components/PickerSheet';

import { SIGNUP_COUNTRIES } from '@/features/auth/signupCountries';

export const PROFILE_COUNTRIES: PickerOption[] = SIGNUP_COUNTRIES.map((c) => ({
  key: c.iso2,
  title: c.name,
  subtitle: c.iso2,
}));

/** Subdivisions keyed by ISO2 country code. */
export const STATES_BY_COUNTRY: Record<string, PickerOption[]> = {
  CA: [
    { key: 'AB', title: 'Alberta' },
    { key: 'BC', title: 'British Columbia' },
    { key: 'MB', title: 'Manitoba' },
    { key: 'NB', title: 'New Brunswick' },
    { key: 'NL', title: 'Newfoundland and Labrador' },
    { key: 'NS', title: 'Nova Scotia' },
    { key: 'NT', title: 'Northwest Territories' },
    { key: 'NU', title: 'Nunavut' },
    { key: 'ON', title: 'Ontario' },
    { key: 'PE', title: 'Prince Edward Island' },
    { key: 'QC', title: 'Quebec' },
    { key: 'SK', title: 'Saskatchewan' },
    { key: 'YT', title: 'Yukon' },
  ],
  US: [
    { key: 'AL', title: 'Alabama' },
    { key: 'AK', title: 'Alaska' },
    { key: 'AZ', title: 'Arizona' },
    { key: 'AR', title: 'Arkansas' },
    { key: 'CA', title: 'California' },
    { key: 'CO', title: 'Colorado' },
    { key: 'CT', title: 'Connecticut' },
    { key: 'DE', title: 'Delaware' },
    { key: 'FL', title: 'Florida' },
    { key: 'GA', title: 'Georgia' },
    { key: 'HI', title: 'Hawaii' },
    { key: 'ID', title: 'Idaho' },
    { key: 'IL', title: 'Illinois' },
    { key: 'IN', title: 'Indiana' },
    { key: 'IA', title: 'Iowa' },
    { key: 'KS', title: 'Kansas' },
    { key: 'KY', title: 'Kentucky' },
    { key: 'LA', title: 'Louisiana' },
    { key: 'ME', title: 'Maine' },
    { key: 'MD', title: 'Maryland' },
    { key: 'MA', title: 'Massachusetts' },
    { key: 'MI', title: 'Michigan' },
    { key: 'MN', title: 'Minnesota' },
    { key: 'MS', title: 'Mississippi' },
    { key: 'MO', title: 'Missouri' },
    { key: 'MT', title: 'Montana' },
    { key: 'NE', title: 'Nebraska' },
    { key: 'NV', title: 'Nevada' },
    { key: 'NH', title: 'New Hampshire' },
    { key: 'NJ', title: 'New Jersey' },
    { key: 'NM', title: 'New Mexico' },
    { key: 'NY', title: 'New York' },
    { key: 'NC', title: 'North Carolina' },
    { key: 'ND', title: 'North Dakota' },
    { key: 'OH', title: 'Ohio' },
    { key: 'OK', title: 'Oklahoma' },
    { key: 'OR', title: 'Oregon' },
    { key: 'PA', title: 'Pennsylvania' },
    { key: 'RI', title: 'Rhode Island' },
    { key: 'SC', title: 'South Carolina' },
    { key: 'SD', title: 'South Dakota' },
    { key: 'TN', title: 'Tennessee' },
    { key: 'TX', title: 'Texas' },
    { key: 'UT', title: 'Utah' },
    { key: 'VT', title: 'Vermont' },
    { key: 'VA', title: 'Virginia' },
    { key: 'WA', title: 'Washington' },
    { key: 'WV', title: 'West Virginia' },
    { key: 'WI', title: 'Wisconsin' },
    { key: 'WY', title: 'Wyoming' },
    { key: 'DC', title: 'District of Columbia' },
  ],
  GB: [
    { key: 'ENG', title: 'England' },
    { key: 'SCT', title: 'Scotland' },
    { key: 'WLS', title: 'Wales' },
    { key: 'NIR', title: 'Northern Ireland' },
  ],
  NG: [
    { key: 'AB', title: 'Abia' },
    { key: 'FC', title: 'Federal Capital Territory' },
    { key: 'LA', title: 'Lagos' },
    { key: 'OY', title: 'Oyo' },
    { key: 'RI', title: 'Rivers' },
    { key: 'KD', title: 'Kaduna' },
    { key: 'KN', title: 'Kano' },
    { key: 'AN', title: 'Anambra' },
    { key: 'EN', title: 'Enugu' },
    { key: 'IM', title: 'Imo' },
    { key: 'OTHER', title: 'Other state' },
  ],
  GH: [
    { key: 'AA', title: 'Greater Accra' },
    { key: 'AH', title: 'Ashanti' },
    { key: 'WP', title: 'Western' },
    { key: 'EP', title: 'Eastern' },
    { key: 'NP', title: 'Northern' },
    { key: 'OTHER', title: 'Other region' },
  ],
  KE: [
    { key: '30', title: 'Nairobi' },
    { key: '01', title: 'Mombasa' },
    { key: '22', title: 'Kiambu' },
    { key: '32', title: 'Nakuru' },
    { key: 'OTHER', title: 'Other county' },
  ],
};

export const SOURCE_OF_INCOME_OPTIONS: PickerOption[] = [
  { key: 'EMPLOYMENT', title: 'Employment' },
  { key: 'SELF_EMPLOYMENT', title: 'Self-employment' },
  { key: 'BUSINESS', title: 'Business' },
  { key: 'INVESTMENTS', title: 'Investments' },
  { key: 'PENSION', title: 'Pension / retirement' },
  { key: 'FAMILY_SUPPORT', title: 'Family support' },
  { key: 'OTHER', title: 'Other' },
];

export const MONTHLY_TX_OPTIONS: PickerOption[] = [
  { key: '0_2000', title: '0 – 2,000' },
  { key: '2001_5000', title: '2,001 – 5,000' },
  { key: '5001_10000', title: '5,001 – 10,000' },
  { key: '10001_25000', title: '10,001 – 25,000' },
  { key: '25001_PLUS', title: '25,001+' },
];

export function optionTitle(options: readonly PickerOption[], key: string | null | undefined): string {
  if (!key) return '';
  return options.find((o) => o.key === key)?.title ?? key;
}
