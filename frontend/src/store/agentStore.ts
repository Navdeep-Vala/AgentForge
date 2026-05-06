import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';
import { AgentDefinition } from '../types';
import { listAgents, createAgent, updateAgent, deleteAgent } from '../api/client';
import { useAppDispatch, useAppSelector } from './hooks';
import type { RootState } from './store';

interface AgentState {
  agents: AgentDefinition[];
  isLoading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  addAgent: (data: {
    name: string;
    description: string;
    system_prompt: string;
    model: string;
    color: string;
    icon: string;
  }) => Promise<void>;
  editAgent: (
    id: string,
    data: Partial<AgentDefinition>
  ) => Promise<void>;
  removeAgent: (id: string) => Promise<void>;
}

const initialState: Omit<AgentState, 'fetchAgents' | 'addAgent' | 'editAgent' | 'removeAgent'> = {
  agents: [],
  isLoading: false,
  error: null,
};

export const fetchAgents = createAsyncThunk('agents/fetchAgents', async () => listAgents());

export const addAgent = createAsyncThunk(
  'agents/addAgent',
  async (data: {
    name: string;
    description: string;
    system_prompt: string;
    model: string;
    color: string;
    icon: string;
  }) => createAgent(data)
);

export const editAgent = createAsyncThunk(
  'agents/editAgent',
  async ({ id, data }: { id: string; data: Partial<AgentDefinition> }) => updateAgent(id, data)
);

export const removeAgent = createAsyncThunk('agents/removeAgent', async (id: string) => {
  await deleteAgent(id);
  return id;
});

const agentSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAgents.fulfilled, (state, action) => {
        state.agents = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Failed to load agents';
      })
      .addCase(addAgent.fulfilled, (state, action) => {
        state.agents.push(action.payload);
      })
      .addCase(editAgent.fulfilled, (state, action) => {
        state.agents = state.agents.map((agent) =>
          agent.id === action.payload.id ? action.payload : agent
        );
      })
      .addCase(removeAgent.fulfilled, (state, action) => {
        state.agents = state.agents.filter((agent) => agent.id !== action.payload);
      });
  },
});

const selectAgentState = (state: RootState) => state.agents;

export function useAgentStore(): AgentState {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectAgentState);

  const boundFetchAgents = useCallback(
    async () => void (await dispatch(fetchAgents())),
    [dispatch]
  );
  const boundAddAgent = useCallback(
    async (data: Parameters<AgentState['addAgent']>[0]) => void (await dispatch(addAgent(data)).unwrap()),
    [dispatch]
  );
  const boundEditAgent = useCallback(
    async (id: string, data: Partial<AgentDefinition>) =>
      void (await dispatch(editAgent({ id, data })).unwrap()),
    [dispatch]
  );
  const boundRemoveAgent = useCallback(
    async (id: string) => void (await dispatch(removeAgent(id)).unwrap()),
    [dispatch]
  );

  return useMemo(
    () => ({
      ...state,
      fetchAgents: boundFetchAgents,
      addAgent: boundAddAgent,
      editAgent: boundEditAgent,
      removeAgent: boundRemoveAgent,
    }),
    [state, boundFetchAgents, boundAddAgent, boundEditAgent, boundRemoveAgent]
  );
}

export default agentSlice.reducer;
