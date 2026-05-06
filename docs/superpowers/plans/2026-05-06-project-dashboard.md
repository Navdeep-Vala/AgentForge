# Project Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing project infrastructure into the live UI — selector in the header, a context-edit modal, and project context injected into agent prompts.

**Architecture:** Seven sequential tasks: register the missing backend route, inject project context in the orchestrator, fix frontend types and API client, update the project store, extend the ProjectSelector component, create ProjectEditModal, then wire ProjectSelector into AppHeader.

**Tech Stack:** Node.js / Express 5 / TypeScript (backend), React 18 / Zustand / Tailwind CSS / Vite (frontend), MySQL via mysql2.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/routes/project.routes.ts` | Modify | Register missing sync route |
| `backend/src/orchestrator/orchestrator.ts` | Modify | Inject project context into goal before decompose |
| `frontend/src/types/index.ts` | Modify | Add `description` and `repo_context` to `Project` |
| `frontend/src/api/client.ts` | Modify | Add `syncProjectRepo` function |
| `frontend/src/store/projectStore.ts` | Modify | Add `description` param to `createProject` |
| `frontend/src/components/ProjectSelector/ProjectSelector.tsx` | Modify | Add description/repo_url to create form, edit button, render modal |
| `frontend/src/components/ProjectSelector/ProjectEditModal.tsx` | Create | Full project edit modal with repo sync |
| `frontend/src/components/Layout/AppHeader.tsx` | Modify | Add ProjectSelector, wire project into session start |

---

## Task 1: Register the sync route

**Files:**
- Modify: `backend/src/routes/project.routes.ts`

- [ ] **Step 1: Add the sync route**

Replace the file content:

```ts
import { Router } from 'express';
import * as projectController from '../controllers/project.controller';

const router = Router();

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.post('/:id/sync', projectController.syncProjectRepo);

export default router;
```

- [ ] **Step 2: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/project.routes.ts
git commit -m "feat: register POST /api/projects/:id/sync route"
```

---

## Task 2: Inject project context into the orchestrator

**Files:**
- Modify: `backend/src/orchestrator/orchestrator.ts` (lines 1–25, the import block + startSession body)

- [ ] **Step 1: Add `getProjectById` to the imports**

Find this import block at the top of `backend/src/orchestrator/orchestrator.ts`:

```ts
import {
  createSession,
  createTask,
  updateSessionStatus,
  updateSessionFinalReport,
  updateTaskStatus,
  updateTaskComplete,
  cancelSessionTasks,
  getTasksBySessionId,
  incrementSessionTokens,
} from '../db/queries';
```

Replace with:

```ts
import {
  createSession,
  createTask,
  updateSessionStatus,
  updateSessionFinalReport,
  updateTaskStatus,
  updateTaskComplete,
  cancelSessionTasks,
  getTasksBySessionId,
  incrementSessionTokens,
  getProjectById,
} from '../db/queries';
```

- [ ] **Step 2: Build enriched goal after createSession**

In `startSession()`, find this line (after `await createSession(session)`):

```ts
    const agentDescriptions = await getActiveAgentDescriptions();
```

Insert the following block immediately before it:

```ts
    // Inject project context into goal for LLM calls (best-effort)
    let enrichedGoal = goal;
    if (projectId) {
      try {
        const project = await getProjectById(projectId);
        if (project) {
          const parts: string[] = [`[Project: ${project.name}]`];
          if (project.description) parts.push(`[Description: ${project.description}]`);
          if (project.repo_context) {
            parts.push(`\n${project.repo_context.slice(0, 50_000)}`);
          }
          enrichedGoal = `${parts.join('\n')}\n\n---\nGoal: ${goal}`;
        }
      } catch {
        // best-effort — proceed with original goal if project fetch fails
      }
    }

```

- [ ] **Step 3: Pass enrichedGoal to decompose**

Find:

```ts
      plan = await managerAgent.decompose(goal, agentDescriptions, signal, agentOverrides?.manager?.modelId);
```

Replace with:

```ts
      plan = await managerAgent.decompose(enrichedGoal, agentDescriptions, signal, agentOverrides?.manager?.modelId);
```

- [ ] **Step 4: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/orchestrator/orchestrator.ts
git commit -m "feat: inject project description and repo context into manager goal"
```

---

## Task 3: Fix frontend Project type + add sync API function

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add missing fields to Project interface**

In `frontend/src/types/index.ts`, find:

```ts
export interface Project {
  id: string;
  name: string;
  repo_url: string | null;
  workspace_path: string | null;
  created_at: number;
  updated_at: number;
}
```

Replace with:

```ts
export interface Project {
  id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  repo_context: string | null;
  workspace_path: string | null;
  created_at: number;
  updated_at: number;
}
```

- [ ] **Step 2: Add syncProjectRepo to API client**

In `frontend/src/api/client.ts`, add at the end of the file:

```ts
export async function syncProjectRepo(id: string): Promise<{ size: number }> {
  const res = await api.post<{ success: boolean; size: number }>(`/projects/${id}/sync`, {});
  return res.data;
}
```

- [ ] **Step 3: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors (or only errors from files not yet updated in later tasks).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/client.ts
git commit -m "feat: add description/repo_context to Project type and syncProjectRepo API"
```

---

## Task 4: Update projectStore to support description

**Files:**
- Modify: `frontend/src/store/projectStore.ts`

- [ ] **Step 1: Update the store interface and createProject implementation**

Replace the entire file:

```ts
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
  createProject: (name: string, description?: string, repoUrl?: string, workspacePath?: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const res = await client.api.get<Project[]>('/projects');
      set({ projects: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  createProject: async (name, description, repoUrl, workspacePath) => {
    set({ isLoading: true });
    try {
      const res = await client.api.post<Project>('/projects', {
        name,
        description: description || null,
        repo_url: repoUrl || null,
        workspace_path: workspacePath || null,
      });
      const newProject = res.data;
      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProject: newProject,
        isLoading: false,
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
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        currentProject:
          state.currentProject?.id === id
            ? { ...state.currentProject, ...updates }
            : state.currentProject,
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
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
}));
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors from projectStore.ts.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/projectStore.ts
git commit -m "feat: add description param to projectStore.createProject"
```

---

## Task 5: Create ProjectEditModal

**Files:**
- Create: `frontend/src/components/ProjectSelector/ProjectEditModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react';
import { X, RefreshCw, Check, Trash2, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { syncProjectRepo } from '../../api/client';
import { Project } from '../../types';

interface Props {
  project: Project;
  onClose: () => void;
}

export function ProjectEditModal({ project, onClose }: Props) {
  const { updateProject, deleteProject, fetchProjects } = useProjectStore();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [workspacePath, setWorkspacePath] = useState(project.workspace_path ?? '');
  const [repoUrl, setRepoUrl] = useState(project.repo_url ?? '');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(
    project.repo_context ? `${Math.round(project.repo_context.length / 1024)}KB synced` : null
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        workspace_path: workspacePath.trim() || null,
        repo_url: repoUrl.trim() || null,
        updated_at: Date.now(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
    onClose();
  };

  const handleSync = async () => {
    if (!repoUrl.trim()) return;
    await updateProject(project.id, { repo_url: repoUrl.trim(), updated_at: Date.now() });
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const { size } = await syncProjectRepo(project.id);
      setSyncResult(`Synced · ${Math.round(size / 1024)}KB`);
      await fetchProjects();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text">Edit Project</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-app-col rounded text-app-muted hover:text-app-text transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Description / context notes */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Context / Notes
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this project, tech stack, conventions, or anything agents should know…"
              className="w-full bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Workspace path */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Workspace Path
            </label>
            <input
              type="text"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="/path/to/local/project"
              className="w-full bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Repo URL + sync */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Repo URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setSyncResult(null);
                  setSyncError(null);
                }}
                placeholder="https://github.com/user/repo"
                className="flex-1 bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleSync}
                disabled={!repoUrl.trim() || syncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            </div>
            {syncResult && (
              <p className="flex items-center gap-1 text-[11px] text-emerald-500">
                <Check size={11} />
                {syncResult}
              </p>
            )}
            {syncError && (
              <p className="flex items-center gap-1 text-[11px] text-red-400">
                <AlertCircle size={11} />
                {syncError}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-app-border">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-app-sub hover:bg-app-col transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors from ProjectEditModal.tsx.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProjectSelector/ProjectEditModal.tsx
git commit -m "feat: add ProjectEditModal with context editing and repo sync"
```

---

## Task 6: Extend ProjectSelector with description/repo_url create form and edit button

**Files:**
- Modify: `frontend/src/components/ProjectSelector/ProjectSelector.tsx`

- [ ] **Step 1: Replace the file with the extended version**

```tsx
import React, { useEffect, useState } from 'react';
import { Folder, Plus, ChevronDown, Check, Trash2, Pencil } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { ProjectEditModal } from './ProjectEditModal';
import { Project } from '../../types';

export function ProjectSelector() {
  const { projects, currentProject, fetchProjects, setCurrentProject, createProject, deleteProject } =
    useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newWorkspacePath, setNewWorkspacePath] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createProject(newName.trim(), newDescription.trim() || undefined, newRepoUrl.trim() || undefined, newWorkspacePath.trim() || undefined);
    setNewName('');
    setNewDescription('');
    setNewRepoUrl('');
    setNewWorkspacePath('');
    setShowCreate(false);
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
    }
  };

  const handleEdit = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setIsOpen(false);
    setEditingProject(p);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-app-sub bg-app-col border border-app-border hover:border-app-sub transition-all shadow-sm"
        >
          <Folder size={14} className="text-indigo-400" />
          <span className="max-w-[150px] truncate">
            {currentProject ? currentProject.name : 'Select Project'}
          </span>
          <ChevronDown size={14} className={`text-app-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-2 w-72 bg-app-surface border border-app-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-2 border-b border-app-border flex items-center justify-between">
                <span className="text-[10px] font-semibold text-app-muted uppercase tracking-wider px-2">
                  Projects
                </span>
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="p-1 hover:bg-app-col rounded text-app-muted hover:text-indigo-400 transition-colors"
                  title="New Project"
                >
                  <Plus size={16} />
                </button>
              </div>

              {showCreate && (
                <form onSubmit={handleCreate} className="p-3 border-b border-app-border bg-app-col/50 space-y-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Project name *"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <textarea
                    rows={2}
                    placeholder="Context / notes (optional)…"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="GitHub/GitLab URL (optional)…"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={newRepoUrl}
                    onChange={(e) => setNewRepoUrl(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Workspace path (optional)…"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={newWorkspacePath}
                    onChange={(e) => setNewWorkspacePath(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!newName.trim()}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold py-1.5 rounded uppercase tracking-wider"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="px-2 py-1.5 bg-app-col hover:bg-app-border text-app-sub text-[10px] font-bold rounded uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="max-h-64 overflow-y-auto py-1">
                {/* No-project option */}
                <button
                  onClick={() => { setCurrentProject(null); setIsOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-app-sub hover:bg-app-col transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Folder size={14} className="opacity-50" />
                    <span>General (No Project)</span>
                  </div>
                  {!currentProject && <Check size={14} className="text-indigo-400" />}
                </button>

                {projects.map((p) => (
                  <div key={p.id} className="group relative">
                    <button
                      onClick={() => { setCurrentProject(p); setIsOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        currentProject?.id === p.id
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-app-text hover:bg-app-col'
                      }`}
                    >
                      <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                        <span className="truncate w-40 text-left">{p.name}</span>
                        {p.workspace_path && (
                          <span className="text-[10px] text-app-muted truncate w-40 text-left">
                            {p.workspace_path}
                          </span>
                        )}
                        {p.description && !p.workspace_path && (
                          <span className="text-[10px] text-app-muted truncate w-40 text-left">
                            {p.description}
                          </span>
                        )}
                      </div>
                      {currentProject?.id === p.id && (
                        <Check size={14} className="text-indigo-400 flex-shrink-0" />
                      )}
                    </button>
                    {/* Edit button */}
                    <button
                      onClick={(e) => handleEdit(e, p)}
                      className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 text-app-muted hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit Project"
                    >
                      <Pencil size={12} />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-app-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Project"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {projects.length === 0 && !showCreate && (
                  <p className="py-8 text-center text-xs text-app-muted">No projects yet</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {editingProject && (
        <ProjectEditModal project={editingProject} onClose={() => setEditingProject(null)} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors from ProjectSelector.tsx.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProjectSelector/ProjectSelector.tsx
git commit -m "feat: add description/repo_url to project create form and edit button"
```

---

## Task 7: Wire ProjectSelector into AppHeader

**Files:**
- Modify: `frontend/src/components/Layout/AppHeader.tsx`

- [ ] **Step 1: Add ProjectSelector import and store hook**

At the top of `frontend/src/components/Layout/AppHeader.tsx`, add to the existing imports:

```ts
import { ProjectSelector } from '../ProjectSelector/ProjectSelector';
import { useProjectStore }  from '../../store/projectStore';
```

- [ ] **Step 2: Update the AppHeaderProps.onStart type**

Find:

```ts
interface AppHeaderProps {
  onManageAgents:  () => void;
  onSelectModels:  () => void;
  onLoadSession:   (id: string) => Promise<void>;
  onStart:         (goal: string) => Promise<string | null>;
  onCancel:        () => void;
}
```

Replace with:

```ts
interface AppHeaderProps {
  onManageAgents:  () => void;
  onSelectModels:  () => void;
  onLoadSession:   (id: string) => Promise<void>;
  onStart:         (goal: string, projectId?: string, workspaceDir?: string) => Promise<string | null>;
  onCancel:        () => void;
}
```

- [ ] **Step 3: Add project store usage**

Inside `AppHeader`, find the existing hooks block (where `useSessionStore`, `useThemeStore` are called). Add after them:

```ts
  const { currentProject } = useProjectStore();
```

No `fetchProjects` call needed here — `ProjectSelector` (rendered inside `AppHeader`) already calls it on its own mount.

- [ ] **Step 4: Update handleStart to pass project info**

Find:

```ts
  const handleStart = async () => {
    const g = goal.trim();
    if (!g || isRunning) return;
    const err = validateGoal(g);
    if (err) { setGoalError(err); return; }
    setGoalError('');
    setGoal('');
    setError(null);
    await onStart(g);
  };
```

Replace with:

```ts
  const handleStart = async () => {
    const g = goal.trim();
    if (!g || isRunning) return;
    const err = validateGoal(g);
    if (err) { setGoalError(err); return; }
    setGoalError('');
    setGoal('');
    setError(null);
    await onStart(g, currentProject?.id, currentProject?.workspace_path ?? undefined);
  };
```

Also update `handleRetry` similarly — find:

```ts
  const handleRetry = async () => {
    if (!currentSession?.goal) return;
    const retryGoal = currentSession.goal;
    setError(null);
    await onStart(retryGoal);
  };
```

Replace with:

```ts
  const handleRetry = async () => {
    if (!currentSession?.goal) return;
    const retryGoal = currentSession.goal;
    setError(null);
    await onStart(retryGoal, currentProject?.id, currentProject?.workspace_path ?? undefined);
  };
```

- [ ] **Step 5: Add ProjectSelector to the header JSX**

Find the logo group (the first div inside the `<header>`'s main bar):

```tsx
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="grid grid-cols-2 gap-[3px] w-[14px]">
            {[0,1,2,3].map(i => <div key={i} className="w-[5px] h-[5px] rounded-[1px] bg-app-text opacity-90" />)}
          </div>
          <span className="font-semibold text-sm tracking-tight text-app-text">MISSION CONTROL</span>
          {currentSession && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-app-col text-app-sub border border-app-border">
              {currentSession.id.slice(0, 6).toUpperCase()}
            </span>
          )}
        </div>
```

Add `<ProjectSelector />` immediately after this div (before the goal input div):

```tsx
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="grid grid-cols-2 gap-[3px] w-[14px]">
            {[0,1,2,3].map(i => <div key={i} className="w-[5px] h-[5px] rounded-[1px] bg-app-text opacity-90" />)}
          </div>
          <span className="font-semibold text-sm tracking-tight text-app-text">MISSION CONTROL</span>
          {currentSession && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-app-col text-app-sub border border-app-border">
              {currentSession.id.slice(0, 6).toUpperCase()}
            </span>
          )}
        </div>

        <ProjectSelector />
```

- [ ] **Step 6: Verify full frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Layout/AppHeader.tsx
git commit -m "feat: add ProjectSelector to AppHeader and wire project into session start"
```

---

## Final Verification

- [ ] **Start both servers**

```bash
npm run dev
```

- [ ] **Manual checks**

1. Header shows "Select Project" dropdown next to the logo
2. Click `+` → create a project with name + context notes + repo URL → it appears in the list and is auto-selected
3. Hover a project row → pencil and trash icons appear
4. Click pencil → `ProjectEditModal` opens with all fields populated
5. Edit description → Save → dropdown shows updated description preview
6. Add a GitHub URL → click Sync → loading spinner → "Synced · NKB" confirmation
7. Start a session with a project selected → in backend logs, the manager receives the `[Project: ...]` preamble
8. Delete a project → it disappears from the list

- [ ] **Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "feat: project dashboard with context editing and repo sync"
```
