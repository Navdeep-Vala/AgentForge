import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';
import { FreeModel, listModels } from '../api/client';
import { useAppDispatch, useAppSelector } from './hooks';
import { AgentOverride, loadPersistedAgentOverrides, persistAgentOverrides } from './persistence';
import type { RootState } from './store';

interface ModelState {
  freeModels: FreeModel[];
  agentOverrides: Record<string, AgentOverride>;
  isLoading: boolean;
  fetchModels: () => Promise<void>;
  setAgentModel: (agentType: string, modelId: string) => void;
  setAgentName: (agentType: string, name: string) => void;
  clearAgentOverride: (agentType: string) => void;
}

const initialState: Omit<
  ModelState,
  'fetchModels' | 'setAgentModel' | 'setAgentName' | 'clearAgentOverride'
> = {
  freeModels: [],
  agentOverrides: loadPersistedAgentOverrides(),
  isLoading: false,
};

export const fetchModels = createAsyncThunk('models/fetchModels', async () => {
  const { free } = await listModels();
  return free;
});

const modelSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    setAgentModel(state, action: PayloadAction<{ agentType: string; modelId: string }>) {
      const { agentType, modelId } = action.payload;
      state.agentOverrides = {
        ...state.agentOverrides,
        [agentType]: { ...state.agentOverrides[agentType], modelId },
      };
      persistAgentOverrides(state.agentOverrides);
    },
    setAgentName(state, action: PayloadAction<{ agentType: string; name: string }>) {
      const { agentType, name } = action.payload;
      state.agentOverrides = {
        ...state.agentOverrides,
        [agentType]: { ...state.agentOverrides[agentType], name },
      };
      persistAgentOverrides(state.agentOverrides);
    },
    clearAgentOverride(state, action: PayloadAction<string>) {
      const next = { ...state.agentOverrides };
      delete next[action.payload];
      state.agentOverrides = next;
      persistAgentOverrides(state.agentOverrides);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchModels.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchModels.fulfilled, (state, action) => {
        state.freeModels = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchModels.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const { setAgentModel, setAgentName, clearAgentOverride } = modelSlice.actions;

const selectModelState = (state: RootState) => state.models;

export function useModelStore(): ModelState {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectModelState);

  const boundFetchModels = useCallback(
    async () => void (await dispatch(fetchModels())),
    [dispatch]
  );
  const boundSetAgentModel = useCallback(
    (agentType: string, modelId: string) => {
      dispatch(setAgentModel({ agentType, modelId }));
    },
    [dispatch]
  );
  const boundSetAgentName = useCallback(
    (agentType: string, name: string) => {
      dispatch(setAgentName({ agentType, name }));
    },
    [dispatch]
  );
  const boundClearAgentOverride = useCallback(
    (agentType: string) => {
      dispatch(clearAgentOverride(agentType));
    },
    [dispatch]
  );

  return useMemo(
    () => ({
      ...state,
      fetchModels: boundFetchModels,
      setAgentModel: boundSetAgentModel,
      setAgentName: boundSetAgentName,
      clearAgentOverride: boundClearAgentOverride,
    }),
    [
      state,
      boundFetchModels,
      boundSetAgentModel,
      boundSetAgentName,
      boundClearAgentOverride,
    ]
  );
}

export default modelSlice.reducer;
