import { useCallback, useMemo, useRef, useState } from 'react';

import { securityErrorMessage } from '@/features/security/errors';
import { baseApi } from '@/services/api/baseApi';
import { toAppError } from '@/services/api/errors';
import { useGetSecurityQuestionsQuery } from '@/services/api/securityApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch, useAppSelector } from '@/store';
import type { SecurityAnswer } from '@/types/api/security';

type OkErr = { ok: true } | { ok: false; error: string; locked?: boolean };

/**
 * Live PIN reset: load configured questions, verify answers, then set a new PIN.
 */
export function useLivePinReset() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const questionsQ = useGetSecurityQuestionsQuery(undefined, { skip: !authenticated });
  const dispatch = useAppDispatch();
  const verifiedAnswers = useRef<SecurityAnswer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = useMemo(() => {
    const list = questionsQ.data ?? [];
    return {
      q1Text: list[0]?.questionText ?? 'What was the name of your first pet?',
      q2Text: list[1]?.questionText ?? 'What was the name of your first school?',
      keys: list.map((q) => q.questionKey),
      ready: list.length >= 2,
    };
  }, [questionsQ.data]);

  const verifyAnswers = useCallback(
    async (a1: string, a2: string): Promise<OkErr> => {
      setError(null);
      const list = questionsQ.data ?? [];
      if (list.length < 2) {
        const msg = 'Security questions are not set up yet.';
        setError(msg);
        return { ok: false, error: msg };
      }
      const answers: SecurityAnswer[] = [
        { questionKey: list[0]!.questionKey, answer: a1.trim() },
        { questionKey: list[1]!.questionKey, answer: a2.trim() },
      ];
      setBusy(true);
      try {
        const result = await securityCommands.verifyAnswers({ answers });
        if (!result.ok) {
          const appErr = toAppError(result.error);
          const msg = securityErrorMessage(appErr);
          setError(msg);
          return {
            ok: false,
            error: msg,
            locked: appErr.code === 'PIN_LOCKED' || appErr.code === 'SECURITY_ANSWER_LOCKED',
          };
        }
        verifiedAnswers.current = answers;
        return { ok: true };
      } catch (raw) {
        const appErr = toAppError(raw);
        const msg = securityErrorMessage(appErr);
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setBusy(false);
      }
    },
    [questionsQ.data],
  );

  const resetPin = useCallback(
    async (newPin: string): Promise<OkErr> => {
      setError(null);
      const answers = verifiedAnswers.current;
      if (!answers) {
        const msg = 'Answer your security questions first.';
        setError(msg);
        return { ok: false, error: msg };
      }
      setBusy(true);
      try {
        const result = await securityCommands.resetPin({ answers, newPin });
        if (!result.ok) {
          const msg = securityErrorMessage(toAppError(result.error));
          setError(msg);
          return { ok: false, error: msg };
        }
        verifiedAnswers.current = null;
        dispatch(baseApi.util.invalidateTags(['Security']));
        return { ok: true };
      } catch (raw) {
        const msg = securityErrorMessage(toAppError(raw));
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setBusy(false);
      }
    },
    [dispatch],
  );

  return {
    backend: true as const,
    q1Text: questions.q1Text,
    q2Text: questions.q2Text,
    questionsReady: questions.ready,
    questionsLoading: questionsQ.isLoading,
    busy,
    error,
    clearError: () => setError(null),
    verifyAnswers,
    resetPin,
  };
}
