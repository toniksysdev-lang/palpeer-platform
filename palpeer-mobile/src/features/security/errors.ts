import type { AppError } from '@/services/api/errors';
import { formatClockTime } from '@/utils/datetime';

/** VERIFIED security error codes (PinService, SecurityQuestionService, DeviceService). */
const MESSAGES: Record<string, string> = {
  PIN_INVALID: "That PIN isn't right.",
  PIN_ALREADY_SET: 'You already have a PIN. Use Change PIN instead.',
  PIN_NOT_SET: "You haven't set a transaction PIN yet.",
  RESOURCE_NOT_FOUND: "You haven't set a transaction PIN yet.",
  SECURITY_QUESTIONS_REQUIRED:
    "Resetting your PIN needs security questions, and you haven't set any up.",
  SECURITY_QUESTIONS_NOT_SET:
    "Resetting your PIN needs security questions, and you haven't set any up.",
  SECURITY_ANSWER_INVALID: "One or more answers don't match what you saved.",
  SECURITY_ANSWER_MISSING: 'Your security questions have changed. Please answer them again.',
  SECURITY_ANSWER_UNKNOWN: 'Your security questions have changed. Please answer them again.',
  SECURITY_QUESTIONS_MIN: 'Choose at least 2 questions.',
  SECURITY_QUESTIONS_DUPLICATE: 'Choose a different question for each answer.',
  DEVICE_EXISTS: 'This device is already registered.',
};

export function isPinLocked(error: AppError): boolean {
  return error.code === 'PIN_LOCKED';
}

export function pinLockedMessage(lockedUntil?: string | null): string {
  const time = formatClockTime(lockedUntil);
  return time
    ? `Too many incorrect attempts. Your PIN is locked until ${time}.`
    : 'Too many incorrect attempts. Your PIN is locked for now — try again later.';
}

export function securityErrorMessage(error: AppError): string {
  if (isPinLocked(error)) return pinLockedMessage();
  return (error.code && MESSAGES[error.code]) || error.message;
}
