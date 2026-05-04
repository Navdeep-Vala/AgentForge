import { create } from 'zustand';

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
}

export const useFeedStore = create<FeedState>((set) => ({
  events: [],
  addEvent: (event) =>
    set((state) => ({
      events: [
        { ...event, id: crypto.randomUUID(), timestamp: Date.now() },
        ...state.events,
      ].slice(0, 80),
    })),
  clear: () => set({ events: [] }),
}));
