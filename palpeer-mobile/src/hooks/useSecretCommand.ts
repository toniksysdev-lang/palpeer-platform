import { useCallback, useState } from 'react';

import type { ApiResult } from '@/services/api/client';

/**
 * Runs a command whose arguments or result are secrets, tracking only a pending flag in React
 * state. Resolves with the data or rejects with the `AppError`.
 */
export function useSecretCommand<A, T>(
  command: (args: A) => Promise<ApiResult<T>>,
): [(args: A) => Promise<T>, boolean] {
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (args: A) => {
      setPending(true);
      try {
        const result = await command(args);
        if (!result.ok) throw result.error;
        return result.data;
      } finally {
        setPending(false);
      }
    },
    [command],
  );
  return [run, pending];
}
