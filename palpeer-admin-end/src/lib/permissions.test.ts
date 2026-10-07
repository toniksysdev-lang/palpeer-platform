import { describe, expect, it } from 'vitest';
import { can } from '@/lib/permissions';

describe('can', () => {
  it('allows when no permission is required', () => {
    expect(can([], undefined)).toBe(true);
    expect(can('unknown', undefined, { isAdmin: false })).toBe(true);
  });

  it('uses admin flag when permissions are unknown', () => {
    expect(can('unknown', 'users:read', { isAdmin: true })).toBe(true);
    expect(can('unknown', 'users:read', { isAdmin: false })).toBe(false);
  });

  it('checks explicit permission lists', () => {
    expect(can(['users:read'], 'users:read')).toBe(true);
    expect(can(['users:read'], 'users:write')).toBe(false);
  });
});
