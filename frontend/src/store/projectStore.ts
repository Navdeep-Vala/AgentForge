import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';
import { Project } from '../types';
import * as client from '../api/client';
import { useAppDispatch, useAppSelector } from './hooks';
import type { RootState } from './store';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, description?: string, repoUrl?: string, workspacePath?: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const initialState: Omit<
  ProjectState,
  'fetchProjects' | 'setCurrentProject' | 'createProject' | 'updateProject' | 'deleteProject'
> = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
};

export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  const res = await client.api.get<Project[]>('/projects');
  return res.data;
});

export const createProject = createAsyncThunk(
  'projects/createProject',
  async ({
    name,
    description,
    repoUrl,
    workspacePath,
  }: {
    name: string;
    description?: string;
    repoUrl?: string;
    workspacePath?: string;
  }) => {
    const res = await client.api.post<Project>('/projects', {
      name,
      description: description || null,
      repo_url: repoUrl || null,
      workspace_path: workspacePath || null,
    });
    return res.data;
  }
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ id, updates }: { id: string; updates: Partial<Project> }) => {
    await client.api.put(`/projects/${id}`, updates);
    return { id, updates };
  }
);

export const deleteProject = createAsyncThunk('projects/deleteProject', async (id: string) => {
  await client.api.delete(`/projects/${id}`);
  return id;
});

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setCurrentProject(state, action: PayloadAction<Project | null>) {
      state.currentProject = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.projects = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Failed to load projects';
      })
      .addCase(createProject.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.projects = [action.payload, ...state.projects];
        state.currentProject = action.payload;
        state.isLoading = false;
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Failed to create project';
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        const { id, updates } = action.payload;
        state.projects = state.projects.map((project) =>
          project.id === id ? { ...project, ...updates } : project
        );
        if (state.currentProject?.id === id) {
          state.currentProject = { ...state.currentProject, ...updates };
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.error = action.error.message ?? 'Failed to update project';
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.projects = state.projects.filter((project) => project.id !== action.payload);
        if (state.currentProject?.id === action.payload) {
          state.currentProject = null;
        }
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.error = action.error.message ?? 'Failed to delete project';
      });
  },
});

export const { setCurrentProject } = projectSlice.actions;

const selectProjectState = (state: RootState) => state.projects;

export function useProjectStore(): ProjectState {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectProjectState);

  const boundFetchProjects = useCallback(
    async () => void (await dispatch(fetchProjects())),
    [dispatch]
  );
  const boundSetCurrentProject = useCallback(
    (project: Project | null) => {
      dispatch(setCurrentProject(project));
    },
    [dispatch]
  );
  const boundCreateProject = useCallback(
    async (name: string, description?: string, repoUrl?: string, workspacePath?: string) =>
      dispatch(createProject({ name, description, repoUrl, workspacePath })).unwrap(),
    [dispatch]
  );
  const boundUpdateProject = useCallback(
    async (id: string, updates: Partial<Project>) =>
      void (await dispatch(updateProject({ id, updates })).unwrap()),
    [dispatch]
  );
  const boundDeleteProject = useCallback(
    async (id: string) => void (await dispatch(deleteProject(id)).unwrap()),
    [dispatch]
  );

  return useMemo(
    () => ({
      ...state,
      fetchProjects: boundFetchProjects,
      setCurrentProject: boundSetCurrentProject,
      createProject: boundCreateProject,
      updateProject: boundUpdateProject,
      deleteProject: boundDeleteProject,
    }),
    [
      state,
      boundFetchProjects,
      boundSetCurrentProject,
      boundCreateProject,
      boundUpdateProject,
      boundDeleteProject,
    ]
  );
}

export default projectSlice.reducer;
