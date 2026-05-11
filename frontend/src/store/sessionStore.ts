import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';
import { Session, Task, TaskComment, ChatMessage, SubAgent, ClarificationRequest, TaskStatus, SessionStatus } from '../types';
import { useAppDispatch, useAppSelector } from './hooks';
import type { RootState } from './store';

interface SessionState {
  currentSession: Session | null;
  comments: Record<string, TaskComment[]>; // keyed by task_id
  chatMessages: ChatMessage[];
  subAgents: SubAgent[];
  clarificationRequests: ClarificationRequest[];
  childTasks: Record<string, string[]>; // keyed by parent_task_id
  agentSteps: Record<string, any[]>; // keyed by task_id
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

  setSubAgents: (subAgents: SubAgent[]) => void;
  addSubAgent: (subAgent: SubAgent) => void;

  setClarificationRequests: (clarifications: ClarificationRequest[]) => void;
  addClarificationRequest: (clarification: ClarificationRequest) => void;

  updateSubAgentStatus: (subAgentId: string, status: SubAgent['status'], output?: string | null, thought?: string | null) => void;

  addChildTask: (parentTaskId: string, childTaskId: string) => void;
  setChildTasks: (parentTaskId: string, childTaskIds: string[]) => void;

  setAgentSteps: (taskId: string, steps: any[]) => void;
  addAgentStep: (taskId: string, step: any) => void;

  reset: () => void;
}

interface SessionSliceState {
  currentSession: Session | null;
  comments: Record<string, TaskComment[]>;
  chatMessages: ChatMessage[];
  subAgents: SubAgent[];
  clarificationRequests: ClarificationRequest[];
  childTasks: Record<string, string[]>;
  agentSteps: Record<string, any[]>;
  isLoading: boolean;
  error: string | null;
}

const initialState: SessionSliceState = {
  currentSession: null,
  comments: {},
  chatMessages: [],
  subAgents: [],
  clarificationRequests: [],
  childTasks: {},
  agentSteps: {},
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
    setSubAgents(state, action: PayloadAction<SubAgent[]>) {
      state.subAgents = action.payload;
    },
    addSubAgent(state, action: PayloadAction<SubAgent>) {
      state.subAgents.push(action.payload);
    },
    setClarificationRequests(state, action: PayloadAction<ClarificationRequest[]>) {
      state.clarificationRequests = action.payload;
    },
    addClarificationRequest(state, action: PayloadAction<ClarificationRequest>) {
      state.clarificationRequests.push(action.payload);
    },
    updateSubAgentStatus(
      state,
      action: PayloadAction<{ subAgentId: string; status: SubAgent['status']; output?: string | null; thought?: string | null }>
    ) {
      const { subAgentId, status, output, thought } = action.payload;
      state.subAgents = state.subAgents.map((sa) =>
        sa.id === subAgentId ? { ...sa, status, ...(output !== undefined ? { output } : {}), ...(thought !== undefined ? { thought } : {}) } : sa
      );
    },
    addChildTask(state, action: PayloadAction<{ parentTaskId: string; childTaskId: string }>) {
      const { parentTaskId, childTaskId } = action.payload;
      const existing = state.childTasks[parentTaskId] ?? [];
      state.childTasks = {
        ...state.childTasks,
        [parentTaskId]: [...existing, childTaskId],
      };
    },
    setChildTasks(state, action: PayloadAction<{ parentTaskId: string; childTaskIds: string[] }>) {
      state.childTasks = {
        ...state.childTasks,
        [action.payload.parentTaskId]: action.payload.childTaskIds,
      };
    },
    setAgentSteps(state, action: PayloadAction<{ taskId: string; steps: any[] }>) {
      state.agentSteps = {
        ...state.agentSteps,
        [action.payload.taskId]: action.payload.steps,
      };
    },
    addAgentStep(state, action: PayloadAction<{ taskId: string; step: any }>) {
      const existing = state.agentSteps[action.payload.taskId] ?? [];
      state.agentSteps = {
        ...state.agentSteps,
        [action.payload.taskId]: [...existing, action.payload.step],
      };
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
  setSubAgents,
  addSubAgent,
  setClarificationRequests,
  addClarificationRequest,
  updateSubAgentStatus,
  addChildTask,
  setChildTasks,
  setAgentSteps,
  addAgentStep,
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
  const boundSetSubAgents = useCallback(
    (subAgents: SubAgent[]) => {
      dispatch(setSubAgents(subAgents));
    },
    [dispatch]
  );
  const boundAddSubAgent = useCallback(
    (subAgent: SubAgent) => {
      dispatch(addSubAgent(subAgent));
    },
    [dispatch]
  );
  const boundSetClarificationRequests = useCallback(
    (clarifications: ClarificationRequest[]) => {
      dispatch(setClarificationRequests(clarifications));
    },
    [dispatch]
  );
  const boundAddClarificationRequest = useCallback(
    (clarification: ClarificationRequest) => {
      dispatch(addClarificationRequest(clarification));
    },
    [dispatch]
  );
  const boundUpdateSubAgentStatus = useCallback(
    (subAgentId: string, status: SubAgent['status'], output?: string | null, thought?: string | null) => {
      dispatch(updateSubAgentStatus({ subAgentId, status, output, thought }));
    },
    [dispatch]
  );
  const boundAddChildTask = useCallback(
    (parentTaskId: string, childTaskId: string) => {
      dispatch(addChildTask({ parentTaskId, childTaskId }));
    },
    [dispatch]
  );
  const boundSetChildTasks = useCallback(
    (parentTaskId: string, childTaskIds: string[]) => {
      dispatch(setChildTasks({ parentTaskId, childTaskIds }));
    },
    [dispatch]
  );
  const boundSetAgentSteps = useCallback(
    (taskId: string, steps: any[]) => {
      dispatch(setAgentSteps({ taskId, steps }));
    },
    [dispatch]
  );
  const boundAddAgentStep = useCallback(
    (taskId: string, step: any) => {
      dispatch(addAgentStep({ taskId, step }));
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
      setSubAgents: boundSetSubAgents,
      addSubAgent: boundAddSubAgent,
      setClarificationRequests: boundSetClarificationRequests,
      addClarificationRequest: boundAddClarificationRequest,
      updateSubAgentStatus: boundUpdateSubAgentStatus,
      addChildTask: boundAddChildTask,
      setChildTasks: boundSetChildTasks,
      setAgentSteps: boundSetAgentSteps,
      addAgentStep: boundAddAgentStep,
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
      boundSetSubAgents,
      boundAddSubAgent,
      boundSetClarificationRequests,
      boundAddClarificationRequest,
      boundAddChildTask,
      boundSetChildTasks,
      boundSetAgentSteps,
      boundAddAgentStep,
      boundReset,
    ]
  );
}

export default sessionSlice.reducer;
