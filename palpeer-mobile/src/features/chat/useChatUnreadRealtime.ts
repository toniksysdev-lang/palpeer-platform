import { useCallback } from 'react';

import { CHAT_ROOMS, CHAT_UNREAD } from '@/services/api/chatApi';
import { baseApi } from '@/services/api/baseApi';
import { useRealtimeDestination } from '@/services/websocket/realtime';
import { useAppDispatch, useAppSelector } from '@/store';

/** VERIFIED: `ChatService.send` pushes each new message to the recipient on this queue. */
export const CHAT_QUEUE = '/user/queue/chat';

/**
 * Keeps the Messages tab unread badge (and room list) fresh while tabs are mounted: each pushed
 * message invalidates unread + rooms; every (re)connect re-reads what was missed offline.
 */
export function useChatUnreadRealtime() {
  const dispatch = useAppDispatch();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');

  const onFrame = useCallback(() => {
    dispatch(baseApi.util.invalidateTags([CHAT_UNREAD, CHAT_ROOMS]));
  }, [dispatch]);

  const onConnected = useCallback(() => {
    dispatch(baseApi.util.invalidateTags([CHAT_UNREAD, CHAT_ROOMS]));
  }, [dispatch]);

  useRealtimeDestination(authenticated ? CHAT_QUEUE : null, { onFrame, onConnected });
}
