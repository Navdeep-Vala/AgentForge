import { configureStore } from '@reduxjs/toolkit';
import agentReducer from './agentStore';
import feedReducer from './feedStore';
import modelReducer from './modelStore';
import projectReducer from './projectStore';
import sessionReducer from './sessionStore';
import themeReducer from './themeStore';

export const store = configureStore({
  reducer: {
    agents: agentReducer,
    feed: feedReducer,
    models: modelReducer,
    projects: projectReducer,
    session: sessionReducer,
    theme: themeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
