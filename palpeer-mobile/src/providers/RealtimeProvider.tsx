import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useRealtime } from '@/services/websocket/realtime';
import { useAppSelector } from '@/store';

/** Feeds sign-in, connectivity and app state into the single realtime connection. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const connection = useRealtime();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const online = useAppSelector((state) => state.network.isOnline);

  useEffect(() => {
    connection.setAuthenticated(authenticated);
  }, [connection, authenticated]);

  useEffect(() => {
    connection.setOnline(online);
  }, [connection, online]);

  useEffect(() => {
    // iOS reports "inactive" for brief interruptions (notification centre); only background counts.
    const subscription = AppState.addEventListener('change', (state) =>
      connection.setForeground(state !== 'background'),
    );
    return () => subscription.remove();
  }, [connection]);

  return children;
}
