# Project Dashboard Design

**Date:** 2026-05-06  
**Feature:** Project management with persistent context  
**Approach:** Option A — Header dropdown + edit modal

---

## Overview

Wire up the existing-but-disconnected `ProjectSelector` into the main `AppHeader`, add project context editing (free-text + repo sync), and inject project context into agent prompts when a session starts under a project.

---

## 1. Data Model Changes

### Frontend types (`frontend/src/types/index.ts`)
Add missing fields to `Project` interface:
```ts
interface Project {
  id: string;
  name: string;
  description: string | null;   // ADD
  repo_url: string | null;
  repo_context: string | null;  // ADD
  workspace_path: string | null;
  created_at: number;
  updated_at: number;
}
```

Backend already has these columns — this is a frontend-only fix.

---

## 2. Backend: Register Sync Route

`POST /api/projects/:id/sync` is implemented in `project.controller.ts` but missing from `project.routes.ts`.

Add to `backend/src/routes/project.routes.ts`:
```ts
router.post('/:id/sync', projectController.syncProjectRepo);
```

---

## 3. Backend: Context Injection

In `backend/src/orchestrator/orchestrator.ts`, inside `startSession()`, after `createSession()` is called:

1. If `projectId` is provided, fetch the project from DB via `queries.getProjectById(projectId)`
2. Build a context preamble:
   ```
   [Project: <name>]
   [Description: <description>]
   
   <repo_context>
   
   ---
   ```
3. Prepend the preamble to the `goal` string passed to `managerAgent.decompose()`.  
   The original `goal` is preserved in the session DB record — only the string sent to the LLM is augmented.

This single injection point flows context through all agent tasks automatically since the manager's decompose output references the enriched goal.

---

## 4. Frontend: `AppHeader` Integration

Add `ProjectSelector` to `AppHeader.tsx`:
- Position: between the logo group and the goal input
- `AppHeader` calls `useProjectStore()` directly (consistent with its existing use of `useSessionStore` and `useThemeStore`) — no prop change needed
- `fetchProjects()` is called on mount inside `AppHeader`
- In `handleStart`, read `currentProject` from the store and call `onStart(goal, currentProject?.id, currentProject?.workspace_path || undefined)`
- Update `AppHeaderProps.onStart` type to `(goal: string, projectId?: string, workspaceDir?: string) => Promise<string | null>` to match `startSession` in `App.tsx`

---

## 5. Frontend: Extended `ProjectSelector`

Extend `frontend/src/components/ProjectSelector/ProjectSelector.tsx`:

**Create form** — add two new fields:
- `description` (optional textarea, 2 rows)
- `repo_url` (optional text input, placeholder: `https://github.com/user/repo`)

Pass these to `createProject()`. Update `projectStore.createProject()` to accept `description`.

**Project rows** — add pencil icon (Edit) alongside existing trash icon (Delete).  
Clicking Edit closes the dropdown and opens `ProjectEditModal`.

---

## 6. Frontend: `ProjectEditModal`

New file: `frontend/src/components/ProjectSelector/ProjectEditModal.tsx`

Props: `project: Project`, `onClose: () => void`

**Fields:**
| Field | Input | Notes |
|-------|-------|-------|
| Name | text | required |
| Description | textarea (4 rows) | free-text context, custom agent instructions |
| Workspace Path | text | local path for agentic loop |
| Repo URL | text | GitHub/GitLab URL |

**Repo sync section:**
- "Sync Repo" button → calls `POST /api/projects/:id/sync`
- Loading state: spinner + "Syncing…"
- Success state: "Synced · {n}KB" in green
- Error state: error message in red
- Context preview: shows first 300 chars of `repo_context` with total char count

**Actions:**
- **Save** — calls `updateProject()` then closes
- **Delete** — confirm dialog → `deleteProject()` → close
- **Close (×)** — discards unsaved changes

**Style:** Match `AgentManager` modal pattern — fixed overlay, centered card, `bg-app-surface` background, `border-app-border`.

---

## 7. API Client (`frontend/src/api/client.ts`)

Add sync endpoint:
```ts
export async function syncProjectRepo(id: string, token?: string): Promise<{ size: number }> {
  const res = await api.post<{ success: boolean; size: number }>(`/projects/${id}/sync`, { token });
  return res.data;
}
```

Also add `createProjectFull` (or update existing `createProject` in store) to send `description` and `repo_url` fields.

---

## 8. Error Handling

- Repo sync failures surface as inline error in the modal (not a toast) — the modal stays open
- If project fetch fails in `startSession`, log the error but do not block session start (context injection is best-effort)
- If `repo_context` is very large (>50KB), truncate to 50K chars before injection to avoid overloading the prompt

---

## Out of Scope

- Repo sync authentication token UI (token field exists in backend but will not be exposed in this iteration)
- Project-level agent overrides
- Pagination of project list
