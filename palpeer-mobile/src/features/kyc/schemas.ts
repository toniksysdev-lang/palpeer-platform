import { z } from 'zod';

import type { StartKycVerificationRequest } from '@/types/api/kyc';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in YYYY-MM-DD that isn't in the future. */
export function isValidPastIsoDate(value: string, today: Date = new Date()): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return isReal && date.getTime() <= todayUtc;
}

/**
 * Mirrors StartKycVerificationRequest: names required (≤80), date of birth optional (≤10 chars,
 * sent as YYYY-MM-DD), issuing country optional (exactly 2 characters).
 */
export const kycSubmitSchema = z.object({
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
    .refine(
      (value) => value === '' || isValidPastIsoDate(value),
      'Use the format YYYY-MM-DD, e.g. 1990-04-21',
    ),
  issuingCountry: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^[A-Za-z]{2}$/.test(value),
      'Use the 2-letter country code, e.g. NG',
    ),
});
export type KycSubmitForm = z.infer<typeof kycSubmitSchema>;

export function toStartVerificationRequest(values: KycSubmitForm): StartKycVerificationRequest {
  const request: StartKycVerificationRequest = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
  };
  const dateOfBirth = values.dateOfBirth.trim();
  const issuingCountry = values.issuingCountry.trim().toUpperCase();
  if (dateOfBirth) request.dateOfBirth = dateOfBirth;
  if (issuingCountry) request.issuingCountry = issuingCountry;
  return request;
}
