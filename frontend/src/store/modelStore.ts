import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FreeModel, listModels } from '../api/client';

interface ModelState {
  freeModels: FreeModel[];
  agentOverrides: Record<string, string>;
  isLoading: boolean;
  fetchModels: () => Promise<void>;
  setAgentModel: (agentType: string, modelId: string) => void;
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
          agentOverrides: { ...state.agentOverrides, [agentType]: modelId },
        })),

      clearAgentOverride: (agentType) =>
        set((state) => {
          const next = { ...state.agentOverrides };
          delete next[agentType];
          return { agentOverrides: next };
        }),
    }),
    {
      name: 'agentforge-model-overrides',
      partialize: (state) => ({ agentOverrides: state.agentOverrides }),
    }
  )
);
