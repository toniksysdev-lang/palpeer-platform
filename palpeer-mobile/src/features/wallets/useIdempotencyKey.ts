import { useCallback, useRef } from 'react';

import { newIdempotencyKey } from '@/services/api/client';

/**
 * One `Idempotency-Key` per user intent (R-G-5): the same key is reused when the same request is
 * retried, so a lost response can't create a second funding or withdrawal. `reset` starts a new
 * intent once the user changes the details.
 */
export function useIdempotencyKey() {
  const key = useRef<string | null>(null);
  const current = useCallback(() => {
    key.current ??= newIdempotencyKey();
    return key.current;
  }, []);
  const reset = useCallback(() => {
    key.current = null;
  }, []);
  return { current, reset };
}
