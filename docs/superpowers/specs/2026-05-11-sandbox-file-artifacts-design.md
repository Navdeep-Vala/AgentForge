# Sandbox File Artifacts — Design

**Date:** 2026-05-11
**Status:** Approved
**Author:** navdeep + Claude

## Goal

Let the Coder agent generate downloadable files (PDF, Excel, Word, charts, images) by writing Python code, executing it in a Docker sandbox, and surfacing a download link in the UI — replicating Claude's file-generation UX.

## Non-goals

- Persistent, never-expiring artifact storage.
- A separate "quick chat" entry point. Existing session/task flow is used.
- File types beyond the initial allowlist (audio/video/archives — future work).
- Multi-tenant access control (single-user system).

## High-level architecture

```
User goal ─► Manager decomposes ─► Coder task dispatched
                                        │
                                        ▼
                       Agentic loop in workspaceDir
                                        │
                                        ▼
                       Coder calls execute_code (Python)
                                        │
                                        ▼
            ToolExecutor.getOrProvisionSandbox()  ◄── lazy, idempotent
                                        │
                                        ▼
                       Python writes report.pdf to /workspace
                                        │
                                        ▼
                       ArtifactDetector scans workspaceDir
                                        │
                                        ▼
              INSERT artifacts row + emit artifact_created SSE
                                        │
                                        ▼
                       Frontend renders ArtifactChip
                       (Task card + LiveFeed + final report)
                                        │
                                        ▼
                       User clicks → GET /api/artifacts/:id/download
```

## Components

### 1. Sandbox image — `backend/src/sandbox/Dockerfile`

Add Python data/doc libs system-wide. Append to existing Dockerfile after the `pip3` step:

```dockerfile
RUN pip3 install --break-system-packages --no-cache-dir \
    reportlab \
    fpdf2 \
    openpyxl \
    xlsxwriter \
    python-docx \
    python-pptx \
    pandas \
    numpy \
    matplotlib \
    pillow
```

Image must be rebuilt — `backend/src/sandbox/build.sh` already handles this; document it in the migration step.

### 2. Per-session workspace bootstrap

Currently sessions only have `workspaceDir` when attached to a project. We need every session — project-attached or ad-hoc — to have a directory the sandbox can mount.

- New helper in `backend/src/services/home-workspace.service.ts` (or new `session-workspace.service.ts`): `ensureSessionWorkspace(sessionId): Promise<string>` that creates and returns `~/.agentforge/sessions/<sessionId>/`.
- `orchestrator.startSession()` calls this for every session. If the session is attached to a project with its own `workspaceDir`, that takes precedence; otherwise the ephemeral session dir is used.
- The path is stored on the session record (`sessions.workspace_dir` column already exists per the schema).

### 3. Lazy sandbox provisioning in ToolExecutor

`backend/src/workspace/tool-executor.ts`:

- Constructor accepts `dockerService` and `sessionId` (already does), plus a new `workspaceDir`.
- Replace the current "containerId provided up front" model with an internal `getOrProvisionSandbox(): Promise<string>` method.
- First call: creates container via `DockerService.createSandbox({ workspacePath: workspaceDir, containerName: \`agentforge-session-\${sessionId}\` })`, caches the resulting `containerId` on `this`, emits SSE `sandbox_starting` then `sandbox_ready`.
- Concurrent calls: serialized via a `Promise<string>` field on the instance to avoid double-provisioning.
- `execute_code` and `run_command` call `await this.getOrProvisionSandbox()` before executing.
- The `sandboxed` boolean flag is removed; `run_command` and `execute_code` become always-available because they will lazy-provision.

The agentic loop (`agentic-loop.ts`) no longer needs to be passed `containerId`. It still passes `workspaceDir`. Cleanup is the orchestrator's responsibility (see #11).

### 4. Artifact auto-detection

New service `backend/src/services/artifact-detector.service.ts`:

```ts
class ArtifactDetector {
  constructor(
    private workspaceDir: string,
    private sessionId: string,
    private taskId: string,
    private agentType: string,
  ) {}

  // Tracks file mtimes seen on previous scans; new/changed files matching
  // allowed extensions are registered.
  async scanAndRegister(): Promise<Artifact[]>;
}
```

- Called from `ToolExecutor` after every successful `write_file`, `execute_code`, or `run_command`.
- Walks `workspaceDir` recursively (depth-limited to 5 to avoid pathological cases).
- Allowed extensions (case-insensitive): `.pdf .xlsx .docx .pptx .csv .png .jpg .jpeg .svg .gif`.
- For each new file with `mtime > lastScanTime`: insert `artifacts` row, emit `artifact_created` SSE.
- Idempotent on `(session_id, task_id, host_path)` — re-running scan does not duplicate rows.
- MIME type derived from extension via a small lookup map (`mime-types` npm package is fine).

### 5. Database — `artifacts` table

New migration in `backend/src/db/migrations.ts`:

```sql
CREATE TABLE IF NOT EXISTS artifacts (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  session_id   VARCHAR(36)  NOT NULL,
  task_id      VARCHAR(36)  NULL,
  agent_type   VARCHAR(64)  NULL,
  filename     VARCHAR(512) NOT NULL,
  mime_type    VARCHAR(128) NOT NULL,
  size_bytes   BIGINT       NOT NULL,
  host_path    TEXT         NOT NULL,
  created_at   BIGINT       NOT NULL,
  expires_at   BIGINT       NOT NULL,
  UNIQUE KEY uq_session_task_path (session_id, task_id, host_path(255)),
  INDEX idx_session (session_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

New queries in `backend/src/db/queries.ts`:
- `insertArtifact(artifact)`
- `getArtifactById(id)`
- `getArtifactsBySession(sessionId)`
- `getArtifactsByTask(taskId)`
- `getExpiredArtifacts()`
- `deleteArtifact(id)`

### 6. Download endpoint

New route `backend/src/routes/artifacts.routes.ts`:

- `GET /api/artifacts/:id/download` — controller looks up the artifact:
  - 404 if not found.
  - 410 Gone if `Date.now() > expires_at`.
  - 404 if file missing from disk.
  - Otherwise streams the file with:
    - `Content-Type: <mime_type>`
    - `Content-Disposition: attachment; filename="<filename>"`
    - `Content-Length: <size_bytes>`
- `GET /api/artifacts/session/:sessionId` — returns the artifact list for a session (used by the final report panel).

### 7. SSE event

Add to `SSEEvent` union in `backend/src/types/index.ts`:

```ts
{
  type: 'artifact_created';
  sessionId: string;
  taskId: string;
  artifactId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;  // e.g. /api/artifacts/<id>/download
  agentType: string;
}
```

Also `sandbox_starting` and `sandbox_ready` events so the UI can show a "spinning up sandbox…" indicator on the active task card.

### 8. Retention cron

In `backend/src/orchestrator/heartbeat.service.ts` (or a new `cleanup.service.ts`):

- `node-cron` job, daily at 03:00 local.
- `getExpiredArtifacts()` → for each row: `fs.unlink(host_path).catch(swallow)`, then `deleteArtifact(id)`.
- Env: `ARTIFACT_RETENTION_DAYS` (default 30). `expires_at = created_at + retentionDays * 86_400_000`.
- Also cleans up empty session workspace dirs older than `ARTIFACT_RETENTION_DAYS` (if no artifacts and session is `completed` or `failed`).

### 9. Frontend

New types in `frontend/src/types/index.ts` mirroring backend `Artifact` and the new SSE events.

`frontend/src/store/sessionStore.ts`:
- Add `artifacts: Record<string, Artifact[]>` keyed by `taskId`, plus a derived selector for "all artifacts in this session".
- New action `upsertArtifact(artifact)` called from `useSSE`.

`frontend/src/hooks/useSSE.ts`:
- Add `case 'artifact_created'` to `handleMessage` → calls `sessionStore.upsertArtifact`.
- Add `case 'sandbox_starting'` / `sandbox_ready` → updates a `taskSandboxStatus` map in the store; surfaces a small "🐳 Sandbox starting…" badge on the task card.

New component `frontend/src/components/ArtifactChip.tsx`:
- Compact pill: file icon by extension, filename, human-readable size, download icon.
- Click triggers a download by hitting `${VITE_API_BASE_URL}/api/artifacts/<id>/download`.
- Uses Tailwind, matches existing chip styles.

`frontend/src/components/TaskCard.tsx`:
- When `artifacts[taskId]?.length > 0`, render an `ArtifactChip` row at the bottom of the card.

`frontend/src/components/LiveFeed.tsx`:
- Add a new feed-item renderer for `artifact_created` events: `📎 <AgentName> produced <ArtifactChip>`.

Final report panel (wherever the manager's `synthesize` output is rendered — likely the same area as `session_complete`):
- After the synthesized markdown, if the session has any artifacts, append a "Generated files" section with all of them as `ArtifactChip`s.

### 10. Coder prompt tweak

Edit `backend/src/agents/coder.agent.ts`. Replace the existing Mode A block with:

> **### Mode A: FILE DELIVERABLE (PDF, Excel, Word, charts, images)**
> When the task asks for a downloadable file, use `execute_code` with `language: "python"` to write the actual binary file to the current working directory (`/workspace`). Available libraries: `reportlab`, `fpdf2`, `openpyxl`, `xlsxwriter`, `python-docx`, `python-pptx`, `pandas`, `numpy`, `matplotlib`, `pillow`.
>
> The system **auto-detects** any new file matching `.pdf .xlsx .docx .pptx .csv .png .jpg .jpeg .svg .gif` extensions and registers it as a downloadable artifact — you do **not** need to call any registration tool. The download link will appear in the UI automatically.
>
> Workflow:
> 1. Pick the right library for the format.
> 2. Write the Python code that produces the file at a clear filename like `report.pdf` or `q3-sales.xlsx`.
> 3. Call `execute_code`. Confirm `exitCode === 0`.
> 4. Call `task_complete` with a one-line summary; mention the filename.
>
> Do not produce code-only deliverables when a binary file is requested. The user wants the file itself.

### 11. Error handling

| Failure | Handling |
|---|---|
| Docker daemon unreachable on `getOrProvisionSandbox()` | `execute_code` returns `{ success: false, output: "Sandbox provisioning failed: <reason>" }`; agent sees this and either retries or reports failure via `task_complete`. Task is marked `failed` if it can't recover. |
| Python script throws | Existing flow — stderr returned in the tool output, agent fixes and retries. |
| Generated file > some max size (e.g. 50 MB) | `ArtifactDetector` skips registering it and emits a `agent_thinking` event with a warning. (Configurable via env, default 50 MB.) |
| File deleted from disk after registration | Download endpoint returns 404; frontend chip shows "file no longer available" state. |
| Race between two `write_file`s producing the same path | `INSERT … ON DUPLICATE KEY UPDATE` semantics via the unique key `(session_id, task_id, host_path)` keeps it idempotent. |
| Session aborted mid-execution | Orchestrator's existing abort/cleanup paths tear down the sandbox container; artifacts already registered remain downloadable until retention expires them. |
| Sandbox cleanup itself fails | Logged, not surfaced to user. Containers labeled `managed-by: agentforge` so a startup sweep can remove orphans. |

### 12. Testing

Manual verification covers the golden path and edge cases since there is no test suite yet:

- **PDF golden path** — fresh non-project session, goal: "Generate a 3-page PDF on the Mars rover." Verify (a) `sandbox_starting` shows in UI, (b) chip appears on Coder's task card, (c) chip appears in LiveFeed, (d) chip appears in final report, (e) download yields a valid PDF.
- **Excel** — "Make me a sales-by-month spreadsheet for FY24 with a chart." Verify `.xlsx` downloads and opens cleanly in Excel/Numbers.
- **Word** — "Write a 2-page memo about Q3 results as a Word doc."
- **Multiple artifacts in one task** — "Generate a sales PDF and the matching Excel." Both chips appear.
- **Project-attached session** — sandbox uses the project workspace; verify no regression in existing coder workflows that already work (e.g., write_file + task_complete only).
- **Retention** — set `ARTIFACT_RETENTION_DAYS=0`, run cleanup cron manually (or expose a debug endpoint), verify files + rows go away and download returns 410.
- **Sandbox failure** — stop the Docker daemon, request a PDF, verify the task fails gracefully with a clear error message rather than hanging.
- **Type-check** — `cd backend && npx tsc --noEmit` and `cd frontend && npx tsc --noEmit` both pass.

## Migration & rollout

1. Rebuild the sandbox image with the new Python libs (`bash backend/src/sandbox/build.sh`).
2. Run backend — migrations create the `artifacts` table on startup.
3. No data migration needed; new feature is additive.

## Open questions / future work

- **Allowlist expansion** — audio/video/archives can be added by appending to the extension list once Python libs and use cases are clear.
- **Inline preview** — for PNG/JPG, the chip could open a modal preview rather than download. Defer.
- **Per-user retention** — currently single-user; multi-user would need ownership checks on the download endpoint.
- **Explicit `register_artifact` tool** — if auto-detection causes false positives, add this as an opt-in override. Not part of v1.
