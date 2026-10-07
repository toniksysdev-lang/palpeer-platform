import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SessionStatus = 'restoring' | 'authenticated' | 'unauthenticated';

/** Why a deliberate sign-out happened, when the login screen should explain it. */
export type SignOutReason = 'passwordChanged' | 'allSessionsEnded' | 'sessionEnded';

export type SessionState = {
  status: SessionStatus;
  userId: string | null;
  email: string | null;
  /** Set when a session ended without the user signing out (refresh rejected). */
  expiredNotice: boolean;
  signOutReason: SignOutReason | null;
};

const initialState: SessionState = {
  status: 'restoring',
  userId: null,
  email: null,
  expiredNotice: false,
  signOutReason: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<{ userId: string; email: string | null }>) {
      state.status = 'authenticated';
      state.userId = action.payload.userId;
      state.email = action.payload.email;
      state.expiredNotice = false;
      state.signOutReason = null;
    },
    sessionAbsent(state) {
      state.status = 'unauthenticated';
      state.userId = null;
      state.email = null;
    },
    sessionExpired(state) {
      state.status = 'unauthenticated';
      state.userId = null;
      state.email = null;
      state.expiredNotice = true;
      state.signOutReason = null;
    },
    signedOut(state, action: PayloadAction<SignOutReason | undefined>) {
      state.status = 'unauthenticated';
      state.userId = null;
      state.email = null;
      state.expiredNotice = false;
      state.signOutReason = action.payload ?? null;
    },
    expiredNoticeDismissed(state) {
      state.expiredNotice = false;
      state.signOutReason = null;
    },
  },
});

export const { sessionStarted, sessionAbsent, sessionExpired, signedOut, expiredNoticeDismissed } =
  sessionSlice.actions;
export default sessionSlice.reducer;
