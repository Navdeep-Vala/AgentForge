import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';
import { Session, Task, TaskComment, ChatMessage, TaskStatus, SessionStatus } from '../types';
import { useAppDispatch, useAppSelector } from './hooks';
import type { RootState } from './store';

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

interface SessionSliceState {
  currentSession: Session | null;
  comments: Record<string, TaskComment[]>;
  chatMessages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SessionSliceState = {
  currentSession: null,
  comments: {},
  chatMessages: [],
  isLoading: false,
  error: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setCurrentSession(state, action: PayloadAction<Session | null>) {
      state.currentSession = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    upsertTask(state, action: PayloadAction<Partial<Task> & { id: string }>) {
      if (!state.currentSession) return;

      const tasks = state.currentSession.tasks ?? [];
      const idx = tasks.findIndex((task) => task.id === action.payload.id);
      let newTasks: Task[];

      if (idx >= 0) {
        newTasks = tasks.map((task) =>
          task.id === action.payload.id ? { ...task, ...action.payload } : task
        );
      } else {
        newTasks = [...tasks, action.payload as Task];
      }
      state.currentSession = { ...state.currentSession, tasks: newTasks };
    },
    updateTaskStatus(
      state,
      action: PayloadAction<{ taskId: string; status: TaskStatus; extra?: Partial<Task> }>
    ) {
      if (!state.currentSession) return;
      const { taskId, status, extra = {} } = action.payload;
      const tasks = (state.currentSession.tasks ?? []).map((task) =>
        task.id === taskId ? { ...task, status, ...extra } : task
      );
      state.currentSession = { ...state.currentSession, tasks };
    },
    setSessionStatus(state, action: PayloadAction<SessionStatus>) {
      if (!state.currentSession) return;
      state.currentSession = { ...state.currentSession, status: action.payload };
    },
    setFinalReport(
      state,
      action: PayloadAction<{ report: string; totalTokens: number; costUsd: number }>
    ) {
      if (!state.currentSession) return;
      state.currentSession = {
        ...state.currentSession,
        final_report: action.payload.report,
        status: 'completed',
        total_tokens_used: action.payload.totalTokens,
        estimated_cost_usd: action.payload.costUsd,
      };
    },
    addComment(state, action: PayloadAction<TaskComment>) {
      const existing = state.comments[action.payload.task_id] ?? [];
      state.comments = {
        ...state.comments,
        [action.payload.task_id]: [...existing, action.payload],
      };
    },
    setComments(state, action: PayloadAction<{ taskId: string; comments: TaskComment[] }>) {
      state.comments = {
        ...state.comments,
        [action.payload.taskId]: action.payload.comments,
      };
    },
    addChatMessage(state, action: PayloadAction<ChatMessage>) {
      state.chatMessages.push(action.payload);
    },
    setChatMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.chatMessages = action.payload;
    },
    reset() {
      return initialState;
    },
  },
});

export const {
  setCurrentSession,
  setLoading,
  setError,
  upsertTask,
  updateTaskStatus,
  setSessionStatus,
  setFinalReport,
  addComment,
  setComments,
  addChatMessage,
  setChatMessages,
  reset,
} = sessionSlice.actions;

const selectSessionState = (state: RootState) => state.session;

export function useSessionStore(): SessionState {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectSessionState);

  const boundSetCurrentSession = useCallback(
    (session: Session | null) => {
      dispatch(setCurrentSession(session));
    },
    [dispatch]
  );
  const boundSetLoading = useCallback(
    (loading: boolean) => {
      dispatch(setLoading(loading));
    },
    [dispatch]
  );
  const boundSetError = useCallback(
    (error: string | null) => {
      dispatch(setError(error));
    },
    [dispatch]
  );
  const boundUpsertTask = useCallback(
    (task: Partial<Task> & { id: string }) => {
      dispatch(upsertTask(task));
    },
    [dispatch]
  );
  const boundUpdateTaskStatus = useCallback(
    (taskId: string, status: TaskStatus, extra?: Partial<Task>) => {
      dispatch(updateTaskStatus({ taskId, status, extra }));
    },
    [dispatch]
  );
  const boundSetSessionStatus = useCallback(
    (status: SessionStatus) => {
      dispatch(setSessionStatus(status));
    },
    [dispatch]
  );
  const boundSetFinalReport = useCallback(
    (report: string, totalTokens: number, costUsd: number) => {
      dispatch(setFinalReport({ report, totalTokens, costUsd }));
    },
    [dispatch]
  );
  const boundAddComment = useCallback(
    (comment: TaskComment) => {
      dispatch(addComment(comment));
    },
    [dispatch]
  );
  const boundSetComments = useCallback(
    (taskId: string, comments: TaskComment[]) => {
      dispatch(setComments({ taskId, comments }));
    },
    [dispatch]
  );
  const boundAddChatMessage = useCallback(
    (message: ChatMessage) => {
      dispatch(addChatMessage(message));
    },
    [dispatch]
  );
  const boundSetChatMessages = useCallback(
    (messages: ChatMessage[]) => {
      dispatch(setChatMessages(messages));
    },
    [dispatch]
  );
  const boundReset = useCallback(() => {
    dispatch(reset());
  }, [dispatch]);

  return useMemo(
    () => ({
      ...state,
      setCurrentSession: boundSetCurrentSession,
      setLoading: boundSetLoading,
      setError: boundSetError,
      upsertTask: boundUpsertTask,
      updateTaskStatus: boundUpdateTaskStatus,
      setSessionStatus: boundSetSessionStatus,
      setFinalReport: boundSetFinalReport,
      addComment: boundAddComment,
      setComments: boundSetComments,
      addChatMessage: boundAddChatMessage,
      setChatMessages: boundSetChatMessages,
      reset: boundReset,
    }),
    [
      state,
      boundSetCurrentSession,
      boundSetLoading,
      boundSetError,
      boundUpsertTask,
      boundUpdateTaskStatus,
      boundSetSessionStatus,
      boundSetFinalReport,
      boundAddComment,
      boundSetComments,
      boundAddChatMessage,
      boundSetChatMessages,
      boundReset,
    ]
  );
}

export default sessionSlice.reducer;
