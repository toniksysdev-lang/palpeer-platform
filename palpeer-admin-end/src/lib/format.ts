/** Display-only formatting. Never use for authoritative money math. */

export function formatInteger(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(value: number | string | null | undefined, maxFractionDigits = 8): string {
  if (value == null || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(numeric);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
