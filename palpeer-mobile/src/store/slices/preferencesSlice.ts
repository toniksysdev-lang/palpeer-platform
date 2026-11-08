import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AppearancePreference = 'system' | 'light' | 'dark';

/** App language — English and French only (design change map). */
export type AppLanguage = 'en' | 'fr';

export type PreferencesState = {
  loaded: boolean;
  appearance: AppearancePreference;
  language: AppLanguage;
  onboardingSeen: boolean;
  /** True after the post-login biometric offer was accepted or dismissed on this install. */
  biometricUnlockPrompted: boolean;
};

const initialState: PreferencesState = {
  loaded: false,
  appearance: 'light',
  language: 'en',
  onboardingSeen: false,
  biometricUnlockPrompted: false,
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    preferencesLoaded(state, action: PayloadAction<Omit<PreferencesState, 'loaded'>>) {
      state.loaded = true;
      state.appearance = action.payload.appearance;
      state.language = action.payload.language;
      state.onboardingSeen = action.payload.onboardingSeen;
      state.biometricUnlockPrompted = action.payload.biometricUnlockPrompted;
    },
    appearanceChanged(state, action: PayloadAction<AppearancePreference>) {
      state.appearance = action.payload;
    },
    languageChanged(state, action: PayloadAction<AppLanguage>) {
      state.language = action.payload;
    },
    onboardingCompleted(state) {
      state.onboardingSeen = true;
    },
    biometricUnlockPromptCompleted(state) {
      state.biometricUnlockPrompted = true;
    },
  },
});

export const {
  preferencesLoaded,
  appearanceChanged,
  languageChanged,
  onboardingCompleted,
  biometricUnlockPromptCompleted,
} = preferencesSlice.actions;
export default preferencesSlice.reducer;
