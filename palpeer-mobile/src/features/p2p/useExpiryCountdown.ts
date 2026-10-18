import { useEffect, useState } from 'react';

import { secondsUntil } from '@/features/exchange/format';

import { formatExpiryCountdown } from './formatExpiry';

/**
 * Live countdown for a P2P request/order expiry. Ticks every second while time remains.
 */
export function useExpiryCountdown(expiresAt: string | null | undefined, active = true) {
  const [now, setNow] = useState(() => Date.now());
  const enabled = active && !!expiresAt;
  const remaining = enabled ? secondsUntil(expiresAt!, now) : 0;
  const expired = enabled && remaining === 0;
  const label = enabled ? formatExpiryCountdown(expiresAt!, now) : null;

  useEffect(() => {
    if (!enabled || expired) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled, expired, expiresAt]);

  return { remaining, expired, label };
}
