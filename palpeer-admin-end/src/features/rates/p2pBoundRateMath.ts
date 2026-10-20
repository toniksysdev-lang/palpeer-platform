/** Matches backend `p2p_rate_bounds` / mobile rate input scale. */
export const RATE_DISPLAY_DECIMALS = 12;

/** Exact typed min/max, keyed by the unit mode when the admin typed them. */
export type BoundsEntryAnchor = {
  /** false = quote per 1 base (stored); true = base per 1 quote */
  switched: boolean;
  minRate: string;
  maxRate: string;
};

function isPositiveRate(value: string): boolean {
  const n = Number(value.trim());
  return Number.isFinite(n) && n > 0;
}

function trimTrailingZeros(fixed: string): string {
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

/**
 * Exact rate for Configured P2P bounds (and similar). Keeps every significant digit from
 * the stored/typed value — no Intl rounding — and drops trailing zeros / a bare `.`
 * so `950.000000000000` shows as `950`.
 */
export function formatExactBoundRate(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  let text = typeof value === 'number' ? String(value) : String(value).trim();
  if (!text) return '—';
  if (/e/i.test(text)) {
    const n = Number(text);
    if (!Number.isFinite(n) || n === 0) return text;
    text = trimTrailingZeros(n.toFixed(RATE_DISPLAY_DECIMALS));
  } else if (text.includes('.')) {
    text = trimTrailingZeros(text);
  }
  return text || '—';
}

/**
 * Reciprocal for display only (capped decimals). Never adopt this as a new typed
 * anchor on flip alone — that is what caused 980 → … → 980.0000002548.
 *
 * Near-whole results (e.g. 1/0.001020408163 → 980.0000002548) snap to the integer
 * so Rate Switch matches mobile "Set your exchange rate" flip-back cleanliness.
 */
export function invertRateDisplay(
  value: string | number,
  maxDecimals: number = RATE_DISPLAY_DECIMALS,
): string {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return '';
  const inverted = 1 / n;
  // 6 dp matches mobile list/rate display; whole numbers drop the fractional noise
  // left by inverting a 12 dp stored reciprocal (980 ↔ 0.001020408163).
  const atDisplayPrecision = Number(inverted.toFixed(6));
  if (Number.isFinite(atDisplayPrecision) && Number.isInteger(atDisplayPrecision) && atDisplayPrecision > 0) {
    return String(atDisplayPrecision);
  }
  return trimTrailingZeros(inverted.toFixed(maxDecimals));
}

/**
 * Flip a min/max pair between quote-per-base and base-per-quote.
 * Endpoints swap because the smaller quote/base becomes the larger base/quote.
 */
export function switchBoundPair(
  minRate: string,
  maxRate: string,
  maxDecimals: number = RATE_DISPLAY_DECIMALS,
): { minRate: string; maxRate: string } {
  return {
    minRate: invertRateDisplay(maxRate, maxDecimals),
    maxRate: invertRateDisplay(minRate, maxDecimals),
  };
}

/**
 * Display bounds for the selected unit. Same unit as the anchor → exact typed
 * strings (round-trip safe). Opposite unit → derived reciprocal for the inputs only.
 */
export function displayBoundsForUnit(
  anchor: BoundsEntryAnchor | null,
  switched: boolean,
): { minRate: string; maxRate: string } {
  if (!anchor) return { minRate: '', maxRate: '' };
  if (anchor.switched === switched) {
    return { minRate: anchor.minRate, maxRate: anchor.maxRate };
  }
  return switchBoundPair(anchor.minRate, anchor.maxRate);
}

/**
 * Applies a form edit. Preserves the typed anchor when the new values are only
 * the derived reciprocal (flip must not re-anchor to truncated display).
 */
export function applyBoundsDisplayEdit(
  current: BoundsEntryAnchor | null,
  switched: boolean,
  minRate: string,
  maxRate: string,
): BoundsEntryAnchor | null {
  if (!minRate.trim() && !maxRate.trim()) return null;
  if (current && current.switched !== switched) {
    const derived = displayBoundsForUnit(current, switched);
    if (minRate === derived.minRate && maxRate === derived.maxRate) return current;
  }
  // Same-unit guard: writing the reciprocal pair of the current anchor keeps the original.
  if (
    current &&
    current.switched === switched &&
    isPositiveRate(current.minRate) &&
    isPositiveRate(current.maxRate) &&
    isPositiveRate(minRate) &&
    isPositiveRate(maxRate)
  ) {
    const reciprocal = switchBoundPair(current.minRate, current.maxRate);
    if (minRate === reciprocal.minRate && maxRate === reciprocal.maxRate) return current;
  }
  return { switched, minRate, maxRate };
}

/** Convert the typed anchor (or current display) to quote-per-base for the API. */
export function toStoredBounds(
  anchor: BoundsEntryAnchor | null,
  displayMin: string,
  displayMax: string,
  displaySwitched: boolean,
): { minRate: string; maxRate: string } {
  const source =
    anchor ??
    (displayMin.trim() || displayMax.trim()
      ? { switched: displaySwitched, minRate: displayMin, maxRate: displayMax }
      : null);
  if (!source) return { minRate: displayMin, maxRate: displayMax };
  if (!source.switched) return { minRate: source.minRate, maxRate: source.maxRate };
  return switchBoundPair(source.minRate, source.maxRate);
}
