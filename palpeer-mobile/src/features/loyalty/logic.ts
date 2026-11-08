import type { LoyaltyPointsBalance, LoyaltyPointsLedgerEntry } from '@/types/api/promotion';
import { LOYALTY_POINTS_PER_CAD } from '@/types/api/promotion';

/** Convert a CAD money string to loyalty points (100 pts = CA$1). */
export function cadToPoints(cad: string | number | null | undefined, perCad = LOYALTY_POINTS_PER_CAD): number {
  const n = typeof cad === 'number' ? cad : Number.parseFloat(String(cad ?? '0'));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * perCad);
}

export function pointsToCad(points: number, perCad = LOYALTY_POINTS_PER_CAD): number {
  if (!Number.isFinite(points) || points <= 0 || perCad <= 0) return 0;
  return points / perCad;
}

export function formatPoints(points: number): string {
  return `${Math.max(0, Math.round(points)).toLocaleString('en-CA')} pts`;
}

export function emptyPointsBalance(): LoyaltyPointsBalance {
  return {
    balancePoints: 0,
    balanceCad: '0',
    earnedPoints: 0,
    usedPoints: 0,
    pointsPerCad: LOYALTY_POINTS_PER_CAD,
    currencyCode: 'CAD',
  };
}

export function pointsEntryLabel(entry: LoyaltyPointsLedgerEntry): string {
  if (entry.entryType === 'EARNED') return 'Earned';
  if (entry.status === 'GRANTED') return 'Credited';
  if (entry.status === 'CANCELLED') return 'Used';
  return 'Used';
}

export function pointsEntryTone(
  entry: LoyaltyPointsLedgerEntry,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (entry.entryType === 'EARNED' || entry.status === 'PENDING') return 'success';
  if (entry.status === 'GRANTED') return 'info';
  if (entry.status === 'CANCELLED') return 'neutral';
  return 'warning';
}
