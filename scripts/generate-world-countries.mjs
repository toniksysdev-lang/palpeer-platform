import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function flagEmoji(iso2) {
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

const [telJs, namesEn] = await Promise.all([
  fetch(
    'https://cdn.jsdelivr.net/npm/country-telephone-data@0.6.3/country_telephone_data.js',
  ).then((r) => r.text()),
  fetch('https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/langs/en.json').then((r) =>
    r.json(),
  ),
]);

const names = namesEn.countries || namesEn;
const start = telJs.indexOf('var allCountries = [');
const end = telJs.indexOf('];', start);
if (start < 0 || end < 0) {
  throw new Error('Could not parse country-telephone-data');
}
const arrLit = telJs.slice(start + 'var allCountries = '.length, end + 1);
const allCountries = Function(`return (${arrLit})`)();

function displayName(iso2, fallback) {
  const raw = names[iso2];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return String(fallback).replace(/\s*\(.*$/, '').trim();
}

const rows = [];
const seen = new Set();
for (const c of allCountries) {
  const iso2 = String(c[1]).toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2) || seen.has(iso2)) continue;
  seen.add(iso2);
  rows.push({
    iso2,
    name: displayName(iso2, c[0]),
    dialCode: `+${String(c[2]).replace(/^\+/, '')}`,
    flag: flagEmoji(iso2),
  });
}
rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));

const adminPath = path.join(root, 'palpeer-admin-end/src/lib/worldCountries.ts');
const adminBody = `export type WorldCountry = {
  iso2: string;
  name: string;
  flag: string;
};

/** ISO 3166-1 alpha-2 countries for admin registration settings. */
export const WORLD_COUNTRIES: WorldCountry[] = ${JSON.stringify(
  rows.map(({ iso2, name, flag }) => ({ iso2, name, flag })),
  null,
  2,
)};

export function countryFlag(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return [...code].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}

export function countryName(iso2: string): string {
  const hit = WORLD_COUNTRIES.find((c) => c.iso2 === iso2.toUpperCase());
  return hit?.name ?? iso2.toUpperCase();
}

export function findWorldCountry(iso2: string): WorldCountry | undefined {
  return WORLD_COUNTRIES.find((c) => c.iso2 === iso2.toUpperCase());
}
`;
fs.writeFileSync(adminPath, adminBody);

const mobilePath = path.join(root, 'palpeer-mobile/src/features/auth/worldCountries.ts');
const mobileBody = `export type WorldCountry = {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
};

/** Full country catalog for phone signup (filtered by admin-enabled ISO codes). */
export const WORLD_COUNTRIES: WorldCountry[] = ${JSON.stringify(rows, null, 2)};

export function findWorldCountry(iso2: string): WorldCountry | undefined {
  return WORLD_COUNTRIES.find((c) => c.iso2 === iso2.toUpperCase());
}
`;
fs.writeFileSync(mobilePath, mobileBody);

console.log(`Wrote ${rows.length} countries`);
console.log(adminPath);
console.log(mobilePath);
