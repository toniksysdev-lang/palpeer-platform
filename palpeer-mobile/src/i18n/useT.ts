import { useCallback } from 'react';

import { useAppSelector } from '@/store';

import { messages, type MessageKey } from './messages';

/** Translate a redesign string. Falls back to English if a key is missing in French. */
export function useT() {
  const language = useAppSelector((state) => state.preferences.language);

  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      const table = messages[language] ?? messages.en;
      let text: string = table[key] ?? messages.en[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [language],
  );
}
