import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import FR_DICT from '@/newui/i18n/fr.json';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { languageChanged, type AppLanguage } from '@/store/slices/preferencesSlice';
import { logger } from '@/utils/logger';

/**
 * Language support.
 * The app is written in English. When French is chosen, every visible string is
 * looked up in the French dictionary (src/newui/i18n/fr.json). Numbers and amounts
 * inside a sentence are templated as {#} so one entry covers every amount.
 * Locale follows Redux preferences (More → Language) so English/French stay in sync.
 *
 * Default language is always English unless the user chose French in More / Profile.
 */
export type Lang = 'en' | 'fr';
/** Legacy prototype key — never read for language; delete if present. */
const LEGACY_KEY = 'palpeer-lang';
const FR = FR_DICT as Record<string, string>;
const TOK = /(?:CA\$|US\$|₦|£|GH₵|KSh ?)?\d[\d,]*(?:\.\d+)?/g;
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();

export function trFr(text: string): string | null {
  const n = norm(text);
  if (!n || !/[A-Za-z]/.test(n)) return null;
  if (FR[n]) return FR[n];
  const vals: string[] = [];
  const key = n.replace(TOK, (m) => {
    vals.push(m);
    return '{#}';
  });
  if (vals.length && FR[key]) {
    let i = 0;
    return FR[key].replace(/\{#\}/g, () => vals[i++] ?? '');
  }
  return null;
}

/** Translate a longer text sentence by sentence (used for the Listen voice). */
export function trFrSentences(text: string): string | null {
  const parts = text.split(/(?<=[.!?])\s+/);
  let hits = 0;
  const out = parts.map((p) => {
    const t = trFr(p);
    if (t) hits++;
    return t || p;
  });
  return hits ? out.join(' ') : null;
}

/** Like trFrSentences, but only when every sentence translates (parts without real words, like "9:42 pm", may stay). */
function trAll(text: string): string | null {
  const parts = norm(text).split(/(?<=[.!?])\s+/);
  if (parts.length < 2) return null;
  const out: string[] = [];
  for (const p of parts) {
    const t = trFr(p);
    if (t) out.push(t);
    else if (!/[A-Za-z]{3,}/.test(p)) out.push(p);
    else return null;
  }
  return out.join(' ');
}

/** Fill {0}, {1} ... in a string. */
export const fill = (s: string, vars: (string | number)[]) => s.replace(/\{(\d)\}/g, (_, i) => String(vars[+i] ?? ''));

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
  tv: (key: string, ...vars: (string | number)[]) => string;
};
const LangCtx = createContext<Ctx>({
  lang: 'en',
  setLang: () => {},
  t: (s) => s,
  tv: (k, ...v) => fill(k, v),
});

function toLang(value: AppLanguage | string | null | undefined): Lang {
  return value === 'fr' ? 'fr' : 'en';
}

async function clearLegacyLangKey() {
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // Ignore storage failures — preference key is source of truth.
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const preferenceLang = useAppSelector((s) => s.preferences.language);
  const preferencesLoaded = useAppSelector((s) => s.preferences.loaded);
  const lang = toLang(preferenceLang);
  const legacyCleared = useRef(false);

  // Drop prototype `palpeer-lang` so it cannot force French on next boot.
  useEffect(() => {
    if (!preferencesLoaded || legacyCleared.current) return;
    legacyCleared.current = true;
    void clearLegacyLangKey().catch((error: unknown) => {
      logger.warn('Could not clear legacy language key', { error });
    });
  }, [preferencesLoaded]);

  const setLang = useCallback(
    (l: Lang) => {
      dispatch(languageChanged(l));
      preferencesStorage.setLanguage(l, { userPicked: true }).catch((error: unknown) => {
        logger.warn('Could not persist language', { error });
      });
      void clearLegacyLangKey();
    },
    [dispatch],
  );

  const t = useCallback((s: string) => (lang === 'fr' && s ? trFr(s) || trAll(s) || s : s), [lang]);
  /** Translate a sentence that has names or emails in it: tv('Hello, {0}', name). */
  const tv = useCallback(
    (key: string, ...vars: (string | number)[]) => fill(lang === 'fr' ? FR[key] || key : key, vars),
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, t, tv }), [lang, setLang, t, tv]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
export const useT = () => useContext(LangCtx).t;
export const useTv = () => useContext(LangCtx).tv;
