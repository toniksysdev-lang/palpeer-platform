import { z } from 'zod';

import type { ProfileResponse, UpdateProfileRequest } from '@/types/api/profile';

import { isValidPastIsoDate } from '@/features/kyc/schemas';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Accepts dd/mm/yyyy or YYYY-MM-DD; returns ISO YYYY-MM-DD or null if empty/invalid. */
export function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ISO_DATE.test(trimmed)) return trimmed;
  const match = DMY.exec(trimmed);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export function toDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = ISO_DATE.exec(iso.trim());
  if (!match) return iso;
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

/** Default calendar / form DOB: today minus `years` (local calendar date). */
export function defaultDateOfBirth(yearsBack = 15, today: Date = new Date()): Date {
  return new Date(today.getFullYear() - yearsBack, today.getMonth(), today.getDate());
}

export function defaultDateOfBirthDisplay(yearsBack = 15, today: Date = new Date()): string {
  const date = defaultDateOfBirth(yearsBack, today);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return toDisplayDate(`${yyyy}-${mm}-${dd}`);
}

export const personalInfoSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Enter your first name')
    .max(80, 'First name must be 80 characters or fewer'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Enter your last name')
    .max(80, 'Last name must be 80 characters or fewer'),
  dateOfBirth: z
    .string()
    .trim()
    .min(1, 'Enter your date of birth')
    .refine((value) => {
      const iso = toIsoDate(value);
      return iso != null && isValidPastIsoDate(iso);
    }, 'Select a valid past date of birth'),
  countryOfResidence: z.string().trim().min(2, 'Select a country').max(2),
  stateTerritory: z.string().trim().min(1, 'Select a state or territory'),
  addressLine1: z
    .string()
    .trim()
    .min(1, 'Enter address line 1')
    .max(200, 'Address must be 200 characters or fewer'),
  addressLine2: z.string().trim().max(200, 'Address must be 200 characters or fewer'),
  city: z.string().trim().min(1, 'Enter your city').max(100),
  postalCode: z.string().trim().min(1, 'Enter your postal / zip code').max(32),
  sourceOfIncome: z.string().trim().min(1, 'Select a source of income'),
  monthlyTransactionEstimate: z.string().trim().min(1, 'Select a monthly estimate'),
});

export type PersonalInfoForm = z.infer<typeof personalInfoSchema>;

export function profileToFormDefaults(profile: ProfileResponse | null): PersonalInfoForm {
  const savedDob = toDisplayDate(profile?.dateOfBirth);
  return {
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    // New / empty profiles open on a DOB 15 years before today.
    dateOfBirth: savedDob || defaultDateOfBirthDisplay(15),
    countryOfResidence: profile?.countryOfResidence ?? '',
    stateTerritory: profile?.stateTerritory ?? '',
    addressLine1: profile?.addressLine1 ?? '',
    addressLine2: profile?.addressLine2 ?? '',
    city: profile?.city ?? '',
    postalCode: profile?.postalCode ?? '',
    sourceOfIncome: profile?.sourceOfIncome ?? '',
    monthlyTransactionEstimate: profile?.monthlyTransactionEstimate ?? '',
  };
}

export function toUpdateProfileRequest(values: PersonalInfoForm): UpdateProfileRequest {
  const dateOfBirth = toIsoDate(values.dateOfBirth)!;
  const addressLine2 = values.addressLine2.trim();
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    dateOfBirth,
    countryOfResidence: values.countryOfResidence.trim().toUpperCase(),
    stateTerritory: values.stateTerritory.trim(),
    addressLine1: values.addressLine1.trim(),
    addressLine2: addressLine2.length > 0 ? addressLine2 : null,
    city: values.city.trim(),
    postalCode: values.postalCode.trim(),
    sourceOfIncome: values.sourceOfIncome.trim(),
    monthlyTransactionEstimate: values.monthlyTransactionEstimate.trim(),
  };
}
