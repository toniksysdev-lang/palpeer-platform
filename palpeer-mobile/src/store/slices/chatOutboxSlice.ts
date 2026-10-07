import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Messages the user typed that the server hasn't confirmed yet. Kept in memory only; once the
 * server returns the message it lives in the RTK Query history cache and leaves the outbox.
 */
export type OutboxMessage = {
  clientMessageId: string;
  content: string;
  queuedAt: string;
  status: 'sending' | 'failed';
  error: string | null;
};

type OutboxState = Record<string, OutboxMessage[]>;

const initialState: OutboxState = {};

type RoomMessage = { roomId: string; clientMessageId: string };

const chatOutboxSlice = createSlice({
  name: 'chatOutbox',
  initialState,
  reducers: {
    messageQueued(state, action: PayloadAction<{ roomId: string; message: OutboxMessage }>) {
      const list = (state[action.payload.roomId] ??= []);
      list.push(action.payload.message);
    },
    messageRetrying(state, action: PayloadAction<RoomMessage>) {
      const item = state[action.payload.roomId]?.find(
        (message) => message.clientMessageId === action.payload.clientMessageId,
      );
      if (item) {
        item.status = 'sending';
        item.error = null;
      }
    },
    messageFailed(state, action: PayloadAction<RoomMessage & { error: string }>) {
      const item = state[action.payload.roomId]?.find(
        (message) => message.clientMessageId === action.payload.clientMessageId,
      );
      if (item) {
        item.status = 'failed';
        item.error = action.payload.error;
      }
    },
    messageConfirmed(state, action: PayloadAction<RoomMessage>) {
      const list = state[action.payload.roomId];
      if (!list) return;
      state[action.payload.roomId] = list.filter(
        (message) => message.clientMessageId !== action.payload.clientMessageId,
      );
    },
    outboxCleared() {
      return initialState;
    },
  },
});

export const { messageQueued, messageRetrying, messageFailed, messageConfirmed, outboxCleared } =
  chatOutboxSlice.actions;
export default chatOutboxSlice.reducer;
