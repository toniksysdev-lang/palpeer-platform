import type { Tone } from '@/theme';

/**
 * Backend status enums → display tone. Only values that exist in the backend enums are listed;
 * anything unrecognised falls back to neutral rather than guessing.
 */
const TONE_BY_STATUS: Record<string, Tone> = {
  // success
  SUCCESS: 'success',
  COMPLETED: 'success',
  APPROVED: 'success',
  ACTIVE: 'success',
  ACCEPTED: 'success',
  EXECUTED: 'success',
  SETTLED: 'success',
  GRANTED: 'success',
  SENT: 'success',
  // in progress
  PENDING: 'warning',
  PENDING_VERIFICATION: 'warning',
  PROCESSING: 'warning',
  INITIATED: 'warning',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  // open for action
  OPEN: 'info',
  // failed or blocked
  FAILED: 'danger',
  REJECTED: 'danger',
  BLOCKED: 'danger',
  SUSPENDED: 'danger',
  // ended without success
  REVERSED: 'neutral',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  CLOSED: 'neutral',
  SUPERSEDED: 'neutral',
  NOT_STARTED: 'neutral',
  READ: 'neutral',
};

export function toneForStatus(status: string | null | undefined): Tone {
  if (!status) return 'neutral';
  return TONE_BY_STATUS[status.toUpperCase()] ?? 'neutral';
}

/** "UNDER_REVIEW" → "Under review". */
export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  const words = status.toLowerCase().split('_').filter(Boolean);
  if (words.length === 0) return 'Unknown';
  const [first = '', ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
