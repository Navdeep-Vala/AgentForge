import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FreeModel, listModels } from '../api/client';

interface AgentOverride {
  modelId?: string;
  name?: string;
}

interface ModelState {
  freeModels: FreeModel[];
  agentOverrides: Record<string, AgentOverride>;
  isLoading: boolean;
  fetchModels: () => Promise<void>;
  setAgentModel: (agentType: string, modelId: string) => void;
  setAgentName: (agentType: string, name: string) => void;
  clearAgentOverride: (agentType: string) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      freeModels: [],
      agentOverrides: {},
      isLoading: false,

      fetchModels: async () => {
        set({ isLoading: true });
        try {
          const { free } = await listModels();
          set({ freeModels: free, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      setAgentModel: (agentType, modelId) =>
        set((state) => ({
          agentOverrides: {
            ...state.agentOverrides,
            [agentType]: { ...state.agentOverrides[agentType], modelId },
          },
        })),

      setAgentName: (agentType, name) =>
        set((state) => ({
          agentOverrides: {
            ...state.agentOverrides,
            [agentType]: { ...state.agentOverrides[agentType], name },
          },
        })),

      clearAgentOverride: (agentType) =>
        set((state) => {
          const next = { ...state.agentOverrides };
          delete next[agentType];
          return { agentOverrides: next };
        }),
    }),
    {
      name: 'agentforge-model-overrides-v2',
      partialize: (state) => ({ agentOverrides: state.agentOverrides }),
    }
  )
);
