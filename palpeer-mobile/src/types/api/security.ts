import type { IsoInstant, Uuid } from './common';

/** VERIFIED: GET /security/pin. Lock timestamps use admin Settings → PIN lockout policy. */
export type PinStatusResponse = {
  pinSet: boolean;
  /** Wrong PIN attempts exhausted. */
  lockedUntil: IsoInstant | null;
  /** Wrong security-answer attempts exhausted (Forgot PIN). */
  securityAnswersLockedUntil?: IsoInstant | null;
};

/** VERIFIED: `SetPinRequest` — `pin` matches `\d{4,8}` (provisional P3-01). */
export type SetPinRequest = { pin: string };

/** VERIFIED: `ChangePinRequest`. */
export type ChangePinRequest = { currentPin: string; newPin: string };

/** VERIFIED: `VerifyPinRequest`. */
export type VerifyPinRequest = { pin: string };

/** VERIFIED: `SecurityAnswerRequest` — answers compared trimmed and lower-cased. */
export type SecurityAnswer = { questionKey: string; answer: string };

/** VERIFIED: `ResetPinRequest` — every configured question must be answered. */
export type ResetPinRequest = { answers: SecurityAnswer[]; newPin: string };

/** VERIFIED: `VerifySecurityAnswersRequest` — same answers shape as PIN reset. */
export type VerifySecurityAnswersRequest = { answers: SecurityAnswer[] };

/** VERIFIED: `SecurityQuestionInput` (key ≤120, text ≤500, answer 1–200). */
export type SecurityQuestionInput = { questionKey: string; questionText: string; answer: string };

/** VERIFIED: `SetSecurityQuestionsRequest` — at least 2, distinct keys; replaces all. */
export type SetSecurityQuestionsRequest = { questions: SecurityQuestionInput[] };

/** VERIFIED: the caller's own configured questions (never answers). */
export type SecurityQuestionResponse = { id: Uuid; questionKey: string; questionText: string };

/** VERIFIED: `RegisterDeviceRequest`. `biometricCredential` is opaque and never returned. */
export type RegisterDeviceRequest = {
  deviceIdentifier: string;
  platform?: string;
  deviceName?: string;
  biometricCredential: string;
};

/** VERIFIED: `DeviceResponse`. `lastUsedAt` is never set by the backend. */
export type DeviceResponse = {
  id: Uuid;
  deviceIdentifier: string;
  platform: string | null;
  deviceName: string | null;
  enabled: boolean;
  lastUsedAt: IsoInstant | null;
};
