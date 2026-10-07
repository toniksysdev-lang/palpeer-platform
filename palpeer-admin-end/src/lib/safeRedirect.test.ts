import { describe, expect, it } from 'vitest';
import { safeAdminRedirect } from '@/lib/safeRedirect';

describe('safeAdminRedirect', () => {
  it('allows admin-relative paths', () => {
    expect(safeAdminRedirect('/admin/users')).toBe('/admin/users');
    expect(safeAdminRedirect('/admin/users/u-1')).toBe('/admin/users/u-1');
  });

  it('rejects open redirects and non-admin paths', () => {
    expect(safeAdminRedirect('https://evil.example')).toBe('/admin/dashboard');
    expect(safeAdminRedirect('//evil.example')).toBe('/admin/dashboard');
    expect(safeAdminRedirect('/sign-in')).toBe('/admin/dashboard');
    expect(safeAdminRedirect('/admin@evil')).toBe('/admin/dashboard');
    expect(safeAdminRedirect(null)).toBe('/admin/dashboard');
  });
});
