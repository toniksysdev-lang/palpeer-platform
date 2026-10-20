import { describe, expect, it } from 'vitest';
import {
  applyBoundsDisplayEdit,
  displayBoundsForUnit,
  formatExactBoundRate,
  invertRateDisplay,
  toStoredBounds,
  type BoundsEntryAnchor,
} from './p2pBoundRateMath';

describe('p2pBoundRateMath', () => {
  it('shows exact bound rates without reducing digits or trailing decimal padding', () => {
    expect(formatExactBoundRate('950.000000000000')).toBe('950');
    expect(formatExactBoundRate('1000.000000000000')).toBe('1000');
    expect(formatExactBoundRate('0.001020408163')).toBe('0.001020408163');
    expect(formatExactBoundRate(950.0)).toBe('950');
    expect(formatExactBoundRate(0.001020408163)).toBe('0.001020408163');
  });

  it('rate-switch invert snaps float noise back to whole inputted rates', () => {
    // Stored 12 dp reciprocal of 980 / 950 → switch must show clean integers
    expect(invertRateDisplay('0.001020408163')).toBe('980');
    expect(invertRateDisplay('0.001052631579')).toBe('950');
    expect(invertRateDisplay('1000')).toBe('0.001');
    expect(invertRateDisplay('950')).toBe('0.001052631579');
    const flipped = displayBoundsForUnit(
      { switched: false, minRate: '0.001020408163', maxRate: '0.001052631579' },
      true,
    );
    expect(flipped).toEqual({ minRate: '950', maxRate: '980' });
    expect(
      displayBoundsForUnit(
        { switched: false, minRate: '0.001020408163', maxRate: '0.001052631579' },
        false,
      ),
    ).toEqual({ minRate: '0.001020408163', maxRate: '0.001052631579' });
  });

  it('round-trips rate switch without corrupting the typed quote-per-base values', () => {
    const anchor: BoundsEntryAnchor = {
      switched: false,
      minRate: '980',
      maxRate: '1200',
    };
    const flipped = displayBoundsForUnit(anchor, true);
    expect(flipped.minRate).toBe(invertRateDisplay('1200'));
    expect(flipped.maxRate).toBe(invertRateDisplay('980'));
    // Flip back restores exact typed strings
    expect(displayBoundsForUnit(anchor, false)).toEqual({
      minRate: '980',
      maxRate: '1200',
    });
  });

  it('does not re-anchor when the derived reciprocal is written back', () => {
    const anchor: BoundsEntryAnchor = {
      switched: false,
      minRate: '980',
      maxRate: '1200',
    };
    const derived = displayBoundsForUnit(anchor, true);
    expect(applyBoundsDisplayEdit(anchor, true, derived.minRate, derived.maxRate)).toEqual(
      anchor,
    );
    expect(displayBoundsForUnit(applyBoundsDisplayEdit(anchor, true, derived.minRate, derived.maxRate), false)).toEqual(
      {
        minRate: '980',
        maxRate: '1200',
      },
    );
  });

  it('re-anchors on a real edit in the switched unit', () => {
    const anchor: BoundsEntryAnchor = {
      switched: false,
      minRate: '980',
      maxRate: '1200',
    };
    const next = applyBoundsDisplayEdit(anchor, true, '0.001', '0.00102');
    expect(next).toEqual({ switched: true, minRate: '0.001', maxRate: '0.00102' });
  });

  it('converts switched anchors to quote-per-base for storage', () => {
    const anchor: BoundsEntryAnchor = {
      switched: true,
      minRate: '0.001',
      maxRate: '0.001020408163',
    };
    const stored = toStoredBounds(anchor, '', '', true);
    expect(Number(stored.minRate)).toBeCloseTo(1 / 0.001020408163, 6);
    expect(Number(stored.maxRate)).toBeCloseTo(1000, 6);
    expect(Number(stored.minRate)).toBeLessThanOrEqual(Number(stored.maxRate));
  });

  it('saves stored-mode anchors exactly', () => {
    const anchor: BoundsEntryAnchor = {
      switched: false,
      minRate: '980',
      maxRate: '1200',
    };
    expect(toStoredBounds(anchor, 'ignored', 'ignored', true)).toEqual({
      minRate: '980',
      maxRate: '1200',
    });
  });
});
