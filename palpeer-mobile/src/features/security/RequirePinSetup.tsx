import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { useAppSelector } from '@/store';

/**
 * After login, force first-time PIN setup before the rest of the app (create wallet /
 * withdraw / transfer all require a PIN).
 */
export function RequirePinSetup() {
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const pathname = usePathname();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const redirected = useRef(false);

  useEffect(() => {
    if (!authenticated || locked) {
      redirected.current = false;
      return;
    }
    if (pinStatus.isLoading || pinStatus.isFetching || !pinStatus.data) return;
    if (pinStatus.data.pinSet) {
      redirected.current = false;
      return;
    }
    const onSetPin = pathname?.includes('/security/pin/set');
    if (onSetPin || redirected.current) return;
    redirected.current = true;
    router.replace({ pathname: '/security/pin/set', params: { required: '1' } });
  }, [
    authenticated,
    locked,
    pathname,
    pinStatus.data,
    pinStatus.isFetching,
    pinStatus.isLoading,
  ]);

  return null;
}
