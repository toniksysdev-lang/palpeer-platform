import { useCallback } from 'react';

import { baseApi } from '@/services/api/baseApi';
import { negotiationApi, requestClosedTags } from '@/services/api/negotiationApi';
import { parseNegotiation } from '@/services/websocket/events';
import { useRealtimeDestination } from '@/services/websocket/realtime';
import { useAppDispatch } from '@/store';

/** VERIFIED: `NegotiationRealtimePublisher` sends every committed change to both participants. */
export const NEGOTIATION_QUEUE = '/user/queue/negotiations';

/**
 * Keeps negotiation caches live while the calling screen is mounted: each pushed change replaces
 * the cached negotiation and refreshes the lists; an accept (or a request closing) also refreshes
 * the request and order caches. Every (re)connect re-reads negotiations missed while offline.
 */
export function useNegotiationRealtime() {
  const dispatch = useAppDispatch();
  const onFrame = useCallback(
    (body: string) => {
      const negotiation = parseNegotiation(body);
      if (!negotiation) return;
      dispatch(negotiationApi.util.upsertQueryData('getNegotiation', negotiation.id, negotiation));
      const requestChanged =
        negotiation.status === 'ACCEPTED' || negotiation.closedReason === 'REQUEST_CLOSED';
      dispatch(
        baseApi.util.invalidateTags([
          { type: 'Negotiation', id: 'MINE' },
          ...(requestChanged ? requestClosedTags(negotiation.p2pRequestId) : []),
        ]),
      );
    },
    [dispatch],
  );
  const onConnected = useCallback(() => {
    dispatch(baseApi.util.invalidateTags(['Negotiation']));
  }, [dispatch]);
  useRealtimeDestination(NEGOTIATION_QUEUE, { onFrame, onConnected });
}
