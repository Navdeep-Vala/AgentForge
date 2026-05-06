import { create } from 'zustand';
import { Project } from '../types';
import * as client from '../api/client';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, repoUrl?: string, workspacePath?: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

// Extend client with project methods since we added them in backend
// (Normally I would update client.ts, but I'll do it here if needed or just use api directly)

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const res = await (client.api.get('/projects') as any);
      set({ projects: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  createProject: async (name, repoUrl, workspacePath) => {
    set({ isLoading: true });
    try {
      const res = await (client.api.post('/projects', { name, repo_url: repoUrl, workspace_path: workspacePath }) as any);
      const newProject = res.data;
      set((state) => ({ 
        projects: [newProject, ...state.projects],
        currentProject: newProject,
        isLoading: false 
      }));
      return newProject;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateProject: async (id, updates) => {
    try {
      await client.api.put(`/projects/${id}`, updates);
      set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
        currentProject: state.currentProject?.id === id ? { ...state.currentProject, ...updates } : state.currentProject
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteProject: async (id) => {
    try {
      await client.api.delete(`/projects/${id}`);
      set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  }
}));
