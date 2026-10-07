import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NetworkState = {
  /** null until NetInfo reports for the first time. */
  isOnline: boolean | null;
  lastChangedAt: string | null;
};

const initialState: NetworkState = {
  isOnline: null,
  lastChangedAt: null,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    connectivityChanged(state, action: PayloadAction<{ isOnline: boolean; at: string }>) {
      if (state.isOnline === action.payload.isOnline) return;
      state.isOnline = action.payload.isOnline;
      state.lastChangedAt = action.payload.at;
    },
  },
});

export const { connectivityChanged } = networkSlice.actions;
export default networkSlice.reducer;
