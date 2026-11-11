/** Money helpers shared by Add, Change, Send, Withdraw and People. */

export type WalletDef = {
  code: string;
  name: string;
  sym: string;
  dec: number;
  cc: string; // flag
  on?: boolean; // false = not open yet (admin adds it later)
};

export const WALLETS: WalletDef[] = [
  { code: 'CAD', name: 'Canada dollars', sym: 'CA$', dec: 2, cc: 'CA' },
  { code: 'NGN', name: 'Nigeria naira', sym: '₦', dec: 0, cc: 'NG' },
  { code: 'GBP', name: 'UK pounds', sym: '£', dec: 2, cc: 'GB', on: false },
  { code: 'USD', name: 'USA dollars', sym: 'US$', dec: 2, cc: 'US', on: false },
  { code: 'EUR', name: 'Euro', sym: '€', dec: 2, cc: 'EU', on: false },
  { code: 'KES', name: 'Kenya shillings', sym: 'KSh ', dec: 0, cc: 'KE', on: false },
  { code: 'GHS', name: 'Ghana cedis', sym: 'GH₵', dec: 2, cc: 'GH', on: false },
  { code: 'ZAR', name: 'South Africa rand', sym: 'R', dec: 2, cc: 'ZA', on: false },
];
export const W = (code: string): WalletDef => WALLETS.find((w) => w.code === code) || WALLETS[0]!;

/** Format a number with the wallet's symbol, e.g. CA$1,250.00 or ₦90,000. */
export const fmt = (code: string, v: number) => {
  const w = W(code);
  return w.sym + v.toLocaleString('en-CA', { minimumFractionDigits: w.dec, maximumFractionDigits: w.dec });
};

/** Keep an amount typed by the user: up to 11 whole digits, an optional dot and 2 decimals. */
export const amtIn = (v: string) => {
  let t = String(v).replace(/[^0-9.]/g, '');
  const i = t.indexOf('.');
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, 2);
  const parts = t.split('.');
  const a = (parts[0] ?? '').slice(0, 11);
  return parts.length > 1 ? a + '.' + parts[1] : a;
};

/** Show an amount with commas while typing: 100000000 -> 100,000,000 */
export const amtShow = (t: string) => {
  if (!t) return '';
  const parts = String(t).split('.');
  const a = (parts[0] || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? a + '.' + parts[1] : a;
};

export const num = (t: string) => parseFloat(t) || 0;

/** Rates used across the prototype (Palpeer rate, set by admin). */
export const PAL_RATE = { cadToNgn: 900, ngnPerCad: 1000 };

/** P2P fee: CA$2 flat for CA$200 or less, else 0.95%. Each side pays on what they receive. */
export const p2pFeeCad = (cad: number) => (cad <= 200 ? 2 : Math.round(cad * 0.0095 * 100) / 100);

export const ONBOARD_EMAIL = 'sesanelect@yahoo.com';
export const USER = { first: 'Oluwasesan', last: 'Afolabi', username: 'oluwasesan', email: ONBOARD_EMAIL, phone: '+1 506 555 0123' };
