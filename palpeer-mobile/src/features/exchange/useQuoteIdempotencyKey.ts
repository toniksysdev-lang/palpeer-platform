import { useCallback, useRef } from 'react';

import { newIdempotencyKey } from '@/services/api/client';

/**
 * One `Idempotency-Key` per quote (R-G-5): retrying the same quote reuses the key, so a lost
 * response can't execute twice; a new quote is a new intent and gets a new key.
 */
export function useQuoteIdempotencyKey() {
  const entry = useRef<{ quoteId: string; key: string } | null>(null);
  return useCallback((quoteId: string) => {
    if (entry.current?.quoteId !== quoteId) {
      entry.current = { quoteId, key: newIdempotencyKey() };
    }
    return entry.current.key;
  }, []);
}
