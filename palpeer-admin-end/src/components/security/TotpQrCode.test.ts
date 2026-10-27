import { describe, expect, it } from 'vitest';
import { formatTotpSecret } from '@/components/security/TotpQrCode';

describe('formatTotpSecret', () => {
  it('groups Base32 into 4-character chunks for manual entry', () => {
    expect(formatTotpSecret('abcdefghijklmnop')).toBe('ABCD EFGH IJKL MNOP');
  });

  it('strips existing whitespace before grouping', () => {
    expect(formatTotpSecret('abcd efgh')).toBe('ABCD EFGH');
  });
});
