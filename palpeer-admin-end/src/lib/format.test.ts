import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatDecimal,
  formatInteger,
  formatStatusLabel,
} from '@/lib/format';

describe('formatInteger', () => {
  it('formats numbers and handles empty values', () => {
    expect(formatInteger(1200)).toMatch(/1[,.]?200|1200/);
    expect(formatInteger(null)).toBe('—');
    expect(formatInteger(Number.NaN)).toBe('—');
  });
});

describe('formatDecimal', () => {
  it('formats numeric strings without inventing money math', () => {
    expect(formatDecimal('12.5')).toContain('12');
    expect(formatDecimal(null)).toBe('—');
    expect(formatDecimal('not-a-number')).toBe('not-a-number');
  });
});

describe('formatDateTime', () => {
  it('formats ISO timestamps and falls back safely', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('2026-01-15T12:00:00.000Z')).not.toBe('—');
  });
});

describe('formatStatusLabel', () => {
  it('humanizes backend status enums', () => {
    expect(formatStatusLabel('PENDING_VERIFICATION')).toBe('Pending Verification');
    expect(formatStatusLabel(null)).toBe('Unknown');
  });
});
