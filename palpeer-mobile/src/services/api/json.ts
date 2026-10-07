import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';

/**
 * Backend DTO fields holding `BigDecimal` values. They are kept as exact strings on the client;
 * every other number (counts, page indexes, precision) becomes a JS number.
 */
export const MONEY_FIELDS = new Set([
  'amount',
  'availableBalance',
  'pendingBalance',
  'availableBalanceAfter',
  'pendingBalanceAfter',
  'rate',
  'buyRate',
  'sellRate',
  'appliedRate',
  'sourceAmount',
  'targetAmount',
  'secondaryAmount',
  'totalAmount',
  'bonusAmount',
  'availableTotal',
  'pendingTotal',
]);

function revive(key: string, value: unknown): unknown {
  if (!isLosslessNumber(value)) return value;
  if (MONEY_FIELDS.has(key)) return value.toString();
  return value.valueOf();
}

export function parseJson<T>(text: string): T {
  return parse(text, revive) as T;
}

/** Wrap a decimal string so it serialises as a JSON number without passing through a JS float. */
export function jsonDecimal(value: string): LosslessNumber {
  return new LosslessNumber(value);
}

export function stringifyJson(value: unknown): string {
  return stringify(value) ?? 'null';
}
