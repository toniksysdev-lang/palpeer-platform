import type { Uuid } from './common';

/** VERIFIED: ProfileResponse from POST/GET/PUT /profiles. */
export type ProfileResponse = {
  id: Uuid;
  userId: Uuid;
  firstName: string | null;
  lastName: string | null;
  /** ISO date YYYY-MM-DD when set. */
  dateOfBirth: string | null;
  countryOfResidence: string | null;
  stateTerritory: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  sourceOfIncome: string | null;
  monthlyTransactionEstimate: string | null;
  /** True when all required personal-info fields are present. */
  complete: boolean;
};

export type UpdateProfileRequest = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  countryOfResidence: string;
  stateTerritory: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode: string;
  sourceOfIncome: string;
  monthlyTransactionEstimate: string;
};
