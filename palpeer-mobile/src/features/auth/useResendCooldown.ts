import { useCallback, useEffect, useState } from 'react';

/** Client-side resend throttle for UX only; the backend has no resend rate limit. */
export function useResendCooldown(seconds = 60, startActive = true) {
  const [remaining, setRemaining] = useState(startActive ? seconds : 0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const restart = useCallback(() => setRemaining(seconds), [seconds]);

  return { remaining, canResend: remaining <= 0, restart };
}
