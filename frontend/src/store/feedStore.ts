import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './hooks';
import type { RootState } from './store';

export interface FeedEvent {
  id: string;
  type:
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'task_comment'
    | 'chat_message'
    | 'task_spawned'
    | 'session_complete'
    | 'session_started'
    | 'manager_working'
    | 'sub_agent_started'
    | 'sub_agent_complete'
    | 'sub_agent_failed'
    | 'clarification_request'
    | 'clarification_response'
    | 'approval_requested'
    | 'approval_granted'
    | 'approval_rejected'
    | 'approval_result'
    | 'specialized_agent_spawned'
    | 'file_changed'
    | 'error';
  message: string;
  agentName?: string;
  agentColor?: string;
  timestamp: number;
}

interface FeedState {
  events: FeedEvent[];
  addEvent: (event: Omit<FeedEvent, 'id' | 'timestamp'>) => void;
  clear: () => void;
  clearEvents: () => void;
}

const feedSlice = createSlice({
  name: 'feed',
  initialState: {
    events: [],
  } as { events: FeedEvent[] },
  reducers: {
    addEvent(state, action: PayloadAction<Omit<FeedEvent, 'id' | 'timestamp'>>) {
      state.events = [
        { ...action.payload, id: crypto.randomUUID(), timestamp: Date.now() },
        ...state.events,
      ].slice(0, 80);
    },
    clear(state) {
      state.events = [];
    },
    clearEvents(state) {
      state.events = [];
    },
  },
});

export const { addEvent, clear, clearEvents } = feedSlice.actions;

const selectFeedState = (state: RootState) => state.feed;

export function useFeedStore(): FeedState {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectFeedState);

  const boundAddEvent = useCallback(
    (event: Omit<FeedEvent, 'id' | 'timestamp'>) => {
      dispatch(addEvent(event));
    },
    [dispatch]
  );
  const boundClear = useCallback(() => {
    dispatch(clear());
  }, [dispatch]);
  const boundClearEvents = useCallback(() => {
    dispatch(clearEvents());
  }, [dispatch]);

  return useMemo(
    () => ({
      ...state,
      addEvent: boundAddEvent,
      clear: boundClear,
      clearEvents: boundClearEvents,
    }),
    [state, boundAddEvent, boundClear, boundClearEvents]
  );
}

export default feedSlice.reducer;
