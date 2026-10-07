import NetInfo from '@react-native-community/netinfo';
import { useEffect, type ReactNode } from 'react';

import { useAppDispatch } from '@/store';
import { connectivityChanged } from '@/store/slices/networkSlice';

/** Treats "connected but internet unknown" as online to avoid a false offline banner at launch. */
export function NetworkProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
      dispatch(connectivityChanged({ isOnline, at: new Date().toISOString() }));
    });
  }, [dispatch]);

  return children;
}
