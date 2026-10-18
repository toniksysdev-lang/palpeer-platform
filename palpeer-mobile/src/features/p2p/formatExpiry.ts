import { secondsUntil } from '@/features/exchange/format';

/** Human countdown until `expiresAt` (never negative). */
export function formatExpiryCountdown(expiresAt: string, now: number): string {
  const seconds = secondsUntil(expiresAt, now);
  if (seconds <= 0) return 'Expired';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}
