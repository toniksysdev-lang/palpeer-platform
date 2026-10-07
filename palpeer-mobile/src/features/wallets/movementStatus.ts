import type { MoneyMovementStatus } from '@/types/api/wallet';

const IN_PROGRESS: readonly string[] = ['INITIATED', 'PENDING', 'PROCESSING'];

/** INITIATED, PENDING and PROCESSING can still change; SUCCESS, FAILED and REVERSED can't. */
export function isInProgress(status: string): boolean {
  return IN_PROGRESS.includes(status);
}

export const FUNDING_POLL_MS = 5_000;
/** INITIATED without a provider only changes through an operator, so it's checked less often. */
export const IDLE_POLL_MS = 30_000;

export function pollingIntervalFor(
  status: MoneyMovementStatus | undefined,
  hasProvider: boolean,
): number {
  if (!status || !isInProgress(status)) return 0;
  if (status === 'INITIATED' && !hasProvider) return IDLE_POLL_MS;
  return FUNDING_POLL_MS;
}
