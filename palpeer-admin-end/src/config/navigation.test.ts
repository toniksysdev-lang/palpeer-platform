import { describe, expect, it } from 'vitest';
import { findNavItem } from '@/config/navigation';

describe('findNavItem', () => {
  it('highlights Security when settings tab=security', () => {
    expect(findNavItem('/admin/settings', '', '?tab=security')?.id).toBe('security');
  });

  it('highlights Security for legacy #security hash on settings', () => {
    expect(findNavItem('/admin/settings', '#security')?.id).toBe('security');
  });

  it('highlights Settings for the default settings view', () => {
    expect(findNavItem('/admin/settings')?.id).toBe('settings');
  });
});
