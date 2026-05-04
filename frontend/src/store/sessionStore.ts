import { create } from 'zustand';
import { Session, Task, TaskComment, ChatMessage, TaskStatus, SessionStatus } from '../types';

interface SessionState {
  currentSession: Session | null;
  comments: Record<string, TaskComment[]>; // keyed by task_id
  chatMessages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  setCurrentSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  upsertTask: (task: Partial<Task> & { id: string }) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus, extra?: Partial<Task>) => void;
  setSessionStatus: (status: SessionStatus) => void;
  setFinalReport: (report: string, totalTokens: number, costUsd: number) => void;

  addComment: (comment: TaskComment) => void;
  setComments: (taskId: string, comments: TaskComment[]) => void;

  addChatMessage: (message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;

  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  comments: {},
  chatMessages: [],
  isLoading: false,
  error: null,

  setCurrentSession: (session) => set({ currentSession: session }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  upsertTask: (taskUpdate) =>
    set((state) => {
      if (!state.currentSession) return state;
      const tasks = state.currentSession.tasks ?? [];
      const idx = tasks.findIndex((t) => t.id === taskUpdate.id);
      let newTasks: Task[];
      if (idx >= 0) {
        newTasks = tasks.map((t) => (t.id === taskUpdate.id ? { ...t, ...taskUpdate } : t));
      } else {
        newTasks = [...tasks, taskUpdate as Task];
      }
      return { currentSession: { ...state.currentSession, tasks: newTasks } };
    }),

  updateTaskStatus: (taskId, status, extra = {}) =>
    set((state) => {
      if (!state.currentSession) return state;
      const tasks = (state.currentSession.tasks ?? []).map((t) =>
        t.id === taskId ? { ...t, status, ...extra } : t
      );
      return { currentSession: { ...state.currentSession, tasks } };
    }),

  setSessionStatus: (status) =>
    set((state) => {
      if (!state.currentSession) return state;
      return { currentSession: { ...state.currentSession, status } };
    }),

  setFinalReport: (final_report, totalTokens, costUsd) =>
    set((state) => {
      if (!state.currentSession) return state;
      return {
        currentSession: {
          ...state.currentSession,
          final_report,
          status: 'completed' as SessionStatus,
          total_tokens_used: totalTokens,
          estimated_cost_usd: costUsd,
        },
      };
    }),

  addComment: (comment) =>
    set((state) => {
      const existing = state.comments[comment.task_id] ?? [];
      return {
        comments: {
          ...state.comments,
          [comment.task_id]: [...existing, comment],
        },
      };
    }),

  setComments: (taskId, comments) =>
    set((state) => ({
      comments: { ...state.comments, [taskId]: comments },
    })),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  setChatMessages: (messages) => set({ chatMessages: messages }),

  reset: () =>
    set({ currentSession: null, comments: {}, chatMessages: [], isLoading: false, error: null }),
}));
