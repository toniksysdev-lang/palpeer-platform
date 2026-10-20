import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  useGetPinStatusQuery,
  useGetSecurityQuestionsQuery,
} from '@/services/api/securityApi';
import { useAppSelector } from '@/store';

/**
 * After PIN is set, require security questions so PIN reset stays available (Forgot PIN
 * only works with configured answers).
 */
export function RequireSecurityQuestions() {
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const pathname = usePathname();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const questions = useGetSecurityQuestionsQuery(undefined, {
    skip: !authenticated || !pinStatus.data?.pinSet,
  });
  const redirected = useRef(false);

  useEffect(() => {
    if (!authenticated || locked) {
      redirected.current = false;
      return;
    }
    if (pinStatus.isLoading || pinStatus.isFetching || !pinStatus.data) return;
    if (!pinStatus.data.pinSet) {
      redirected.current = false;
      return;
    }
    if (questions.isLoading || questions.isFetching || !questions.data) return;
    if (questions.data.length > 0) {
      redirected.current = false;
      return;
    }
    const onQuestions = pathname?.includes('/security/questions');
    const onSetPin = pathname?.includes('/security/pin/set');
    if (onQuestions || onSetPin || redirected.current) return;
    redirected.current = true;
    router.replace({ pathname: '/security/questions', params: { required: '1' } });
  }, [
    authenticated,
    locked,
    pathname,
    pinStatus.data,
    pinStatus.isFetching,
    pinStatus.isLoading,
    questions.data,
    questions.isFetching,
    questions.isLoading,
  ]);

  return null;
}
