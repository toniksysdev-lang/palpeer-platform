import { SvgXml } from 'react-native-svg';

/** Line icons from the Palpeer design (24 x 24 grid). */
const I: Record<string, [number, string]> = {
  back: [2.6, '<path d="M20 12H5M11 6l-6 6 6 6"/>'],
  listen: [2.2, '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="C"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>'],
  check: [3, '<path d="M5 13l4.5 4.5L19 7"/>'],
  down: [3, '<path d="M5 9l7 7 7-7"/>'],
  up: [3, '<path d="M5 15l7-7 7 7"/>'],
  lock: [2.4, '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'],
  dots: [0, '<circle cx="5" cy="12" r="2.2" fill="C"/><circle cx="12" cy="12" r="2.2" fill="C"/><circle cx="19" cy="12" r="2.2" fill="C"/>'],
  plus: [3, '<path d="M12 4v16M4 12h16"/>'],
  finger: [2, '<path d="M4.5 10a8 8 0 0 1 15 0"/><path d="M6.5 20a14 14 0 0 0 1-6.5 4.5 4.5 0 0 1 9 0c0 2.5-.3 4.8-1 7"/><path d="M12 13.5c0 3.5-.6 6-1.8 8"/><path d="M19.8 15c-.1 1.5-.3 2.9-.7 4.2"/>'],
  finger2: [2, '<path d="M12 11v3c0 2.5-.8 4.5-2 6"/><path d="M8.5 19c.9-1.5 1.5-3 1.5-5v-2a2 2 0 0 1 4 0v2c0 2-.3 3.8-1 5.5"/><path d="M6 15.5c.3-1 .5-2 .5-3.5a5.5 5.5 0 0 1 11 0v2c0 1.5-.1 2.8-.4 4"/><path d="M4 10a8 8 0 0 1 15-3.5"/>'],
  clock: [2.4, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  home: [0, '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="C"/>'],
  homeLine: [2.2, '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  close: [3, '<path d="M6 6l12 12M18 6L6 18"/>'],
  del: [2.4, '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>'],
  chat: [2.2, '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'],
  minus: [3, '<path d="M5 12h14"/>'],
  arrow: [3, '<path d="M4 12h16M14 6l6 6-6 6"/>'],
  plus2: [3, '<path d="M12 5v14M5 12h14"/>'],
  swap: [2.6, '<path d="M8 20V4M3 9l5-5 5 5"/><path d="M16 4v16M11 15l5 5 5-5"/>'],
  change: [2.6, '<path d="M3 8h17M15 3l5 5-5 5"/><path d="M21 16H4M9 11l-5 5 5 5"/>'],
  bank: [2.4, '<path d="M3 10l9-6 9 6z"/><path d="M6 10v8M12 10v8M18 10v8M3 21h18"/>'],
  send: [2.4, '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/><path d="M16 11h6M19 8l3 3-3 3"/>'],
  receipt: [2.2, '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12.5h5"/>'],
  eye: [2.2, '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'],
  bolt: [0, '<path d="M13.5 2 4.5 13.5H11L9.5 22l10-12.5H13z" fill="C"/>'],
  people: [2.2, '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20c0-3.6 2.8-6 6.5-6s6.5 2.4 6.5 6"/><path d="M15.5 4.7a3.6 3.6 0 0 1 0 6.6"/><path d="M18 14.6c2.1.8 3.5 2.8 3.5 5.4"/>'],
  next: [2.8, '<path d="M4 12h15M13 6l6 6-6 6"/>'],
  downArrow: [2.8, '<path d="M12 4v15M6 13l6 6 6-6"/>'],
  share: [2.6, '<path d="M12 15V4M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>'],
  phone: [2.4, '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'],
  shield: [2.4, '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 8v5M12 16h.01"/>'],
  user: [2.4, '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7"/>'],
  gift: [2.4, '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18"/><path d="M12 9C9 9 7 7.5 7 5.5S10.5 3 12 9c1.5-6 5-5.5 5-3.5S15 9 12 9z"/>'],
  card: [2.4, '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'],
  settings: [2.4, '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'],
  invite: [2.4, '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/><path d="M19 8v6M16 11h6"/>'],
  idcard: [2.2, '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5 16c.6-1.5 1.9-2 3.5-2s2.9.5 3.5 2M15 10h4M15 14h4"/>'],
  shop: [2.2, '<path d="M4 21V9h16v12"/><path d="M3 9l2-5h14l2 5"/><path d="M9 21v-6h6v6"/>'],
  person: [2.2, '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>'],
  globe: [2.2, '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9z"/>'],
};
export type IconName = keyof typeof I;

export function Icon({ name, size = 26, color = '#0E1F19', path }: { name?: IconName; size?: number; color?: string; path?: string }) {
  const [sw, inner] = path ? ([2.5, `<path d="${path}"/>`] as [number, string]) : (I[name ?? 'check'] ?? I.check!);
  const xml = `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner.replace(/"C"/g, `"${color}"`)}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
