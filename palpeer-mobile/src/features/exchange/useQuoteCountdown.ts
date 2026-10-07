import { useEffect, useState } from 'react';

import { secondsUntil } from './format';

/**
 * Seconds left on a quote, from the device clock. If the clock is off, execute still returns 409
 * `EXCHANGE_QUOTE_EXPIRED`, which the review screen handles the same way.
 */
export function useQuoteCountdown(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = expiresAt ? secondsUntil(expiresAt, now) : 0;
  const expired = !!expiresAt && remaining === 0;

  useEffect(() => {
    if (!expiresAt || expired) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, expired]);

  return { remaining, expired };
}
