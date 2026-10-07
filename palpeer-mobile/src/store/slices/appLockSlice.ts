import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { sessionAbsent, sessionExpired, signedOut } from './sessionSlice';

export type AppLockState = {
  /** Biometric unlock is on for the signed-in user on this device. */
  biometricEnabled: boolean;
  locked: boolean;
};

const initialState: AppLockState = { biometricEnabled: false, locked: false };

const appLockSlice = createSlice({
  name: 'appLock',
  initialState,
  reducers: {
    biometricRestored(state, action: PayloadAction<boolean>) {
      state.biometricEnabled = action.payload;
      state.locked = action.payload;
    },
    biometricChanged(state, action: PayloadAction<boolean>) {
      state.biometricEnabled = action.payload;
      if (!action.payload) state.locked = false;
    },
    appLocked(state) {
      if (state.biometricEnabled) state.locked = true;
    },
    appUnlocked(state) {
      state.locked = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signedOut, () => initialState)
      .addCase(sessionExpired, () => initialState)
      .addCase(sessionAbsent, () => initialState);
  },
});

export const { biometricRestored, biometricChanged, appLocked, appUnlocked } = appLockSlice.actions;
export default appLockSlice.reducer;
