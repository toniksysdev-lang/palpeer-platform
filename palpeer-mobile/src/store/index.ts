import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector } from 'react-redux';

import { baseApi } from '@/services/api/baseApi';
import { sessionManager } from '@/services/auth/session';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';

import appLockReducer from './slices/appLockSlice';
import chatOutboxReducer, { outboxCleared } from './slices/chatOutboxSlice';
import networkReducer from './slices/networkSlice';
import preferencesReducer from './slices/preferencesSlice';
import sessionReducer, { sessionExpired, sessionStarted, signedOut } from './slices/sessionSlice';

export function createStore() {
  return configureStore({
    reducer: {
      session: sessionReducer,
      preferences: preferencesReducer,
      network: networkReducer,
      appLock: appLockReducer,
      chatOutbox: chatOutboxReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
}

export const store = createStore();
setupListeners(store.dispatch);

sessionManager.setListener({
  onStarted: (session) => store.dispatch(sessionStarted(session)),
  onExpired: () => {
    store.dispatch(baseApi.util.resetApiState());
    store.dispatch(outboxCleared());
    store.dispatch(sessionExpired());
  },
  onSignedOut: (reason) => {
    pendingNavigation.clear();
    store.dispatch(baseApi.util.resetApiState());
    store.dispatch(outboxCleared());
    store.dispatch(signedOut(reason));
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
