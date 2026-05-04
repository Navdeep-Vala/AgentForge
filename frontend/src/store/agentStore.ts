import { create } from 'zustand';
import { AgentDefinition } from '../types';
import { listAgents, createAgent, updateAgent, deleteAgent } from '../api/client';

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

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const agents = await listAgents();
      set({ agents, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load agents', isLoading: false });
    }
  },

  addAgent: async (data) => {
    const agent = await createAgent(data);
    set((state) => ({ agents: [...state.agents, agent] }));
  },

  editAgent: async (id, data) => {
    const updated = await updateAgent(id, data);
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  removeAgent: async (id) => {
    await deleteAgent(id);
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) }));
  },
}));
