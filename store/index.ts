import { configureStore } from '@reduxjs/toolkit';
import sessionRuntimeReducer from './slices/session-runtime-slice';
import featureFlagsReducer from './slices/feature-flags-slice';
import waitingQueueReducer from './slices/waiting-queue-slice';

export const store = configureStore({
  reducer: {
    sessionRuntime: sessionRuntimeReducer,
    featureFlags: featureFlagsReducer,
    waitingQueue: waitingQueueReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
