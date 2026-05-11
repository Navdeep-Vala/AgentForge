# Sandbox File Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Coder agent generate downloadable files (PDF, Excel, Word, charts, images) by running Python in a Docker sandbox, with download links auto-surfaced in the UI — Claude-style.

**Architecture:** Sandbox is provisioned per-session for sessions that don't have a project (project sessions already provision via the existing Mission Control flow). A new `ArtifactDetector` service watches the workspace dir for new files matching an extension allowlist after every tool call; matches are recorded in an `artifacts` DB table and broadcast via SSE. A new `/api/artifacts/:id/download` endpoint streams files to the browser. A retention cron deletes artifacts older than `ARTIFACT_RETENTION_DAYS` (default 30).

**Tech Stack:** Node.js + TypeScript backend, MySQL via `mysql2`, `dockerode` for Docker, React + Vite + Zustand frontend, Tailwind CSS, `node-cron` for retention.

**Spec reference:** `docs/superpowers/specs/2026-05-11-sandbox-file-artifacts-design.md`

**Verification approach:** This repo has no automated test suite (per `CLAUDE.md`). The plan uses TypeScript type-checks (`npx tsc --noEmit`) as the main per-task verification, with focused manual verification steps where behavior is observable end-to-end. Pure logic units (the detector) include simple `node --test` style runtime checks where they're cheap.

---

## File Structure

**Backend — new files:**
- `backend/src/services/artifact-detector.service.ts` — workspace scan + idempotent DB insert
- `backend/src/services/artifact-retention.service.ts` — daily cron, deletes expired rows + files
- `backend/src/controllers/artifact.controller.ts` — download + list-by-session handlers
- `backend/src/routes/artifact.routes.ts` — express router
- `backend/src/services/__tests__/artifact-detector.test.ts` — minimal runtime tests

**Backend — modified files:**
- `backend/src/sandbox/Dockerfile` — install Python data/doc libs
- `backend/src/db/migrations.ts` — `CREATE TABLE artifacts`
- `backend/src/db/queries.ts` — artifact CRUD
- `backend/src/types/index.ts` — `Artifact` interface, new SSE event types
- `backend/src/workspace/tool-executor.ts` — accept `ArtifactDetector`, call after relevant tools
- `backend/src/agents/agentic-loop.ts` — construct + pass `ArtifactDetector`
- `backend/src/orchestrator/orchestrator.ts` — provision sandbox for non-project sessions
- `backend/src/agents/coder.agent.ts` — tighten Mode A prompt
- `backend/src/routes/index.ts` — mount artifact routes
- `backend/src/server.ts` — start retention cron
- `backend/src/config/env.ts` — `ARTIFACT_RETENTION_DAYS`, `ARTIFACT_MAX_SIZE_MB`

**Frontend — new files:**
- `frontend/src/components/ArtifactChip.tsx` — pill UI with download link

**Frontend — modified files:**
- `frontend/src/types/index.ts` — mirror `Artifact` type + new SSE events
- `frontend/src/store/sessionStore.ts` — `artifacts` map + `upsertArtifact` action
- `frontend/src/hooks/useSSE.ts` — handle `artifact_created` / `sandbox_starting` / `sandbox_ready`
- `frontend/src/components/TaskCard.tsx` — render chips on cards
- `frontend/src/components/LiveFeed.tsx` — render artifact_created events
- The component that renders `session_complete` / final report — append a "Generated files" section

---

### Task 1: Add Python file-generation libraries to the sandbox image

**Files:**
- Modify: `backend/src/sandbox/Dockerfile`

- [ ] **Step 1: Append the pip install block**

Open `backend/src/sandbox/Dockerfile`. After the line `&& rm -rf /var/lib/apt/lists/*` (end of the `apt-get install` block, around line 59) and before the `ENV CHROME_PATH=...` line, add:

```dockerfile
# Install Python libs for file-generation deliverables (PDF/Excel/Word/charts)
# --break-system-packages required on Debian Bookworm; libs are isolated to this image.
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

- [ ] **Step 2: Rebuild the sandbox image**

Run:

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend/src/sandbox && bash build.sh
```

Expected: `Successfully tagged agentforge-sandbox:latest`. (If `build.sh` is missing or fails, run `docker build -t agentforge-sandbox:latest .` from the same directory.)

- [ ] **Step 3: Smoke-test the libs**

Run:

```bash
docker run --rm agentforge-sandbox:latest python3 -c "import reportlab, openpyxl, docx, pandas, matplotlib, fpdf, PIL; print('OK')"
```

Expected stdout: `OK`. If any import fails, fix the Dockerfile and re-run Step 2.

- [ ] **Step 4: Commit**

```bash
git add backend/src/sandbox/Dockerfile
git commit -m "feat(sandbox): install Python file-generation libs (reportlab/openpyxl/python-docx/matplotlib)"
```

---

### Task 2: Add `artifacts` table migration

**Files:**
- Modify: `backend/src/db/migrations.ts`

- [ ] **Step 1: Add CREATE TABLE statement**

In `backend/src/db/migrations.ts`, before the final `console.log('[DB] Migrations completed');` line (around line 309), insert:

```ts
  // ── Artifacts ───────────────────────────────────────────────────────────────
  await pool.execute(`
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
      INDEX idx_expires (expires_at),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
```

- [ ] **Step 2: Verify migration runs**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no type errors.

Then start the backend dev server:

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npm run dev
```

Look for `[DB] Migrations completed` in the log. Stop the server with Ctrl-C.

Verify table exists:

```bash
mysql -u <user> -p agentforge -e "DESCRIBE artifacts;"
```

Expected: 10 columns matching the CREATE TABLE.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations.ts
git commit -m "feat(db): add artifacts table migration"
```

---

### Task 3: Add `Artifact` type and SSE event types

**Files:**
- Modify: `backend/src/types/index.ts`

- [ ] **Step 1: Add Artifact interface**

In `backend/src/types/index.ts`, after the `FileChange` interface (around line 62), insert:

```ts
export interface Artifact {
  id: string;
  session_id: string;
  task_id: string | null;
  agent_type: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  host_path: string;
  created_at: number;
  expires_at: number;
}
```

- [ ] **Step 2: Add SSE event interfaces**

Below the `SSEFileChangedEvent` interface (around line 329), insert:

```ts
export interface SSEArtifactCreatedEvent {
  type: 'artifact_created';
  sessionId: string;
  taskId: string | null;
  artifactId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  agentType: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface SSESandboxStartingEvent {
  type: 'sandbox_starting';
  sessionId: string;
  message: string;
}

export interface SSESandboxReadyEvent {
  type: 'sandbox_ready';
  sessionId: string;
  containerId: string;
}
```

- [ ] **Step 3: Add the new events to the SSEEvent union**

Find the `export type SSEEvent = ...` union (around line 396). Add three new members:

```ts
  | SSEArtifactCreatedEvent
  | SSESandboxStartingEvent
  | SSESandboxReadyEvent;
```

(Place them before the closing semicolon — preserve the existing union members.)

- [ ] **Step 4: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/types/index.ts
git commit -m "feat(types): add Artifact and artifact_created / sandbox_* SSE events"
```

---

### Task 4: Add artifact DB queries

**Files:**
- Modify: `backend/src/db/queries.ts`

- [ ] **Step 1: Add CRUD queries**

At the bottom of `backend/src/db/queries.ts`, append:

```ts
// ─── Artifacts ────────────────────────────────────────────────────────────────

import type { Artifact } from '../types';

export async function insertArtifact(artifact: Artifact): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO artifacts (id, session_id, task_id, agent_type, filename, mime_type, size_bytes, host_path, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE size_bytes = VALUES(size_bytes), mime_type = VALUES(mime_type)`,
    [
      artifact.id,
      artifact.session_id,
      artifact.task_id,
      artifact.agent_type,
      artifact.filename,
      artifact.mime_type,
      artifact.size_bytes,
      artifact.host_path,
      artifact.created_at,
      artifact.expires_at,
    ]
  );
}

export async function getArtifactById(id: string): Promise<Artifact | null> {
  const pool = getPool();
  const [rows] = await pool.execute<any[]>(`SELECT * FROM artifacts WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export async function getArtifactBySessionTaskPath(
  sessionId: string,
  taskId: string | null,
  hostPath: string
): Promise<Artifact | null> {
  const pool = getPool();
  const [rows] = await pool.execute<any[]>(
    `SELECT * FROM artifacts WHERE session_id = ? AND ((task_id IS NULL AND ? IS NULL) OR task_id = ?) AND host_path = ?`,
    [sessionId, taskId, taskId, hostPath]
  );
  return rows[0] ?? null;
}

export async function getArtifactsBySession(sessionId: string): Promise<Artifact[]> {
  const pool = getPool();
  const [rows] = await pool.execute<any[]>(
    `SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId]
  );
  return rows;
}

export async function getArtifactsByTask(taskId: string): Promise<Artifact[]> {
  const pool = getPool();
  const [rows] = await pool.execute<any[]>(
    `SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC`,
    [taskId]
  );
  return rows;
}

export async function getExpiredArtifacts(now: number): Promise<Artifact[]> {
  const pool = getPool();
  const [rows] = await pool.execute<any[]>(
    `SELECT * FROM artifacts WHERE expires_at < ?`,
    [now]
  );
  return rows;
}

export async function deleteArtifact(id: string): Promise<void> {
  const pool = getPool();
  await pool.execute(`DELETE FROM artifacts WHERE id = ?`, [id]);
}
```

If `getPool` isn't imported at the top of the file, locate the existing pool import and reuse it (don't add a duplicate import). If the file already imports types from `'../types'` at the top, move the `Artifact` import up there to keep imports grouped.

- [ ] **Step 2: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/queries.ts
git commit -m "feat(db): add artifact CRUD queries"
```

---

### Task 5: Add env config for retention + max size

**Files:**
- Modify: `backend/src/config/env.ts`

- [ ] **Step 1: Read the current env.ts to understand its shape**

```bash
cat backend/src/config/env.ts
```

Note how existing env vars are defined (e.g. with default values, type coercion).

- [ ] **Step 2: Add two new variables**

Following the same pattern as existing entries, add:

```ts
ARTIFACT_RETENTION_DAYS: parseInt(process.env.ARTIFACT_RETENTION_DAYS ?? '30', 10),
ARTIFACT_MAX_SIZE_MB: parseInt(process.env.ARTIFACT_MAX_SIZE_MB ?? '50', 10),
```

Place them next to other numeric config (e.g. near `DEFAULT_HEARTBEAT_INTERVAL_MINUTES`). If the file uses zod schemas, add to the schema and the parsed export object both.

- [ ] **Step 3: Document in .env.example**

Open `backend/.env.example` and add:

```
# Days artifacts (generated files) are kept before automatic cleanup
ARTIFACT_RETENTION_DAYS=30

# Max size in MB for an auto-detected artifact (skipped silently if larger)
ARTIFACT_MAX_SIZE_MB=50
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/env.ts backend/.env.example
git commit -m "feat(config): add ARTIFACT_RETENTION_DAYS and ARTIFACT_MAX_SIZE_MB env"
```

---

### Task 6: Implement `ArtifactDetector` service

**Files:**
- Create: `backend/src/services/artifact-detector.service.ts`

- [ ] **Step 1: Write the service**

Create `backend/src/services/artifact-detector.service.ts`:

```ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Artifact } from '../types';
import { insertArtifact, getArtifactBySessionTaskPath } from '../db/queries';
import { emitSSE } from '../controllers/sse.controller';
import { env } from '../config/env';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.xlsx', '.docx', '.pptx', '.csv',
  '.png', '.jpg', '.jpeg', '.svg', '.gif',
]);

const MIME_TYPES: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv':  'text/csv',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.gif':  'image/gif',
};

const MAX_DEPTH = 5;

export class ArtifactDetector {
  private lastScanMs: number;

  constructor(
    private workspaceDir: string,
    private sessionId: string,
    private taskId: string | null,
    private agentType: string | null,
    private taskStartedAt: number,
  ) {
    this.lastScanMs = taskStartedAt;
  }

  /** Scan the workspace for new/changed artifact-eligible files and register them. */
  async scanAndRegister(): Promise<Artifact[]> {
    const now = Date.now();
    const found: Artifact[] = [];
    const maxBytes = env.ARTIFACT_MAX_SIZE_MB * 1024 * 1024;

    await this.walk(this.workspaceDir, 0, async (filePath, stat) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) return;
      if (stat.mtimeMs <= this.lastScanMs) return;
      if (stat.size > maxBytes) {
        console.warn(`[ArtifactDetector] Skipping ${filePath} — size ${stat.size} > max ${maxBytes}`);
        return;
      }

      const existing = await getArtifactBySessionTaskPath(this.sessionId, this.taskId, filePath);
      if (existing) {
        // Already registered — update lastScan and skip emit
        return;
      }

      const retentionMs = env.ARTIFACT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const artifact: Artifact = {
        id: uuidv4(),
        session_id: this.sessionId,
        task_id: this.taskId,
        agent_type: this.agentType,
        filename: path.basename(filePath),
        mime_type: MIME_TYPES[ext] ?? 'application/octet-stream',
        size_bytes: stat.size,
        host_path: filePath,
        created_at: now,
        expires_at: now + retentionMs,
      };

      await insertArtifact(artifact);
      found.push(artifact);

      emitSSE(this.sessionId, {
        type: 'artifact_created',
        sessionId: this.sessionId,
        taskId: this.taskId,
        artifactId: artifact.id,
        filename: artifact.filename,
        mimeType: artifact.mime_type,
        sizeBytes: artifact.size_bytes,
        downloadUrl: `/api/artifacts/${artifact.id}/download`,
        agentType: this.agentType,
        createdAt: artifact.created_at,
        expiresAt: artifact.expires_at,
      });
    });

    this.lastScanMs = now;
    return found;
  }

  private async walk(
    dir: string,
    depth: number,
    visit: (filePath: string, stat: { mtimeMs: number; size: number }) => Promise<void>,
  ): Promise<void> {
    if (depth > MAX_DEPTH) return;
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      // Skip dotfiles / dotdirs to avoid scanning .git, .docker-compose, etc.
      if (entry.name.startsWith('.')) continue;
      // Skip node_modules and similar known noise dirs
      if (entry.isDirectory() && (entry.name === 'node_modules' || entry.name === 'vendor')) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(fullPath, depth + 1, visit);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          await visit(fullPath, { mtimeMs: stat.mtimeMs, size: stat.size });
        } catch {
          // file vanished between readdir and stat — ignore
        }
      }
    }
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors. If `emitSSE` signature complains because the union doesn't include `artifact_created`, double-check Task 3 was applied to the union list.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/artifact-detector.service.ts
git commit -m "feat: add ArtifactDetector service for workspace artifact auto-registration"
```

---

### Task 7: Minimal runtime test for the detector

**Files:**
- Create: `backend/src/services/__tests__/artifact-detector.test.ts`

This test exercises only the walk + extension-filter logic — DB inserts are stubbed. Uses `node --test` runner (built into Node 20, no extra deps).

- [ ] **Step 1: Stub-friendly refactor (peek before writing test)**

Re-read `artifact-detector.service.ts`. Note that `scanAndRegister` directly imports `insertArtifact`, `getArtifactBySessionTaskPath`, and `emitSSE`. To make it testable without DB/SSE, we will isolate the *walk + classify* logic into a public static helper on the class.

In `artifact-detector.service.ts`, add this static method to the class (above `scanAndRegister`):

```ts
  /** Test helper: returns paths that would be registered, ignoring DB + SSE. */
  static async listCandidates(
    workspaceDir: string,
    sinceMs: number,
    maxBytes: number,
  ): Promise<Array<{ path: string; size: number; mtimeMs: number }>> {
    const detector = new ArtifactDetector(workspaceDir, 'test-session', null, null, sinceMs);
    const out: Array<{ path: string; size: number; mtimeMs: number }> = [];
    await detector.walk(workspaceDir, 0, async (filePath, stat) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) return;
      if (stat.mtimeMs <= sinceMs) return;
      if (stat.size > maxBytes) return;
      out.push({ path: filePath, size: stat.size, mtimeMs: stat.mtimeMs });
    });
    return out;
  }
```

Change `private async walk(...)` to `async walk(...)` (drop the `private`) so the static helper can call it through the instance. (The walk method does no DB/SSE work, so exposing it carries no risk.)

- [ ] **Step 2: Write the test**

Create `backend/src/services/__tests__/artifact-detector.test.ts`:

```ts
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ArtifactDetector } from '../artifact-detector.service';

async function makeTmpDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-detector-'));
}

test('detects allowed extensions', async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, 'report.pdf'), 'PDF');
  await fs.writeFile(path.join(dir, 'data.xlsx'), 'X');
  await fs.writeFile(path.join(dir, 'image.png'), 'P');

  const candidates = await ArtifactDetector.listCandidates(dir, 0, 50 * 1024 * 1024);
  const names = candidates.map(c => path.basename(c.path)).sort();
  assert.deepEqual(names, ['data.xlsx', 'image.png', 'report.pdf']);
});

test('ignores disallowed extensions', async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, 'main.py'), 'print(1)');
  await fs.writeFile(path.join(dir, 'log.txt'), 'log');
  await fs.writeFile(path.join(dir, 'archive.zip'), 'z');

  const candidates = await ArtifactDetector.listCandidates(dir, 0, 50 * 1024 * 1024);
  assert.equal(candidates.length, 0);
});

test('respects sinceMs cutoff', async () => {
  const dir = await makeTmpDir();
  const filePath = path.join(dir, 'old.pdf');
  await fs.writeFile(filePath, 'old');

  // Set mtime to 60s ago.
  const past = new Date(Date.now() - 60_000);
  await fs.utimes(filePath, past, past);

  // sinceMs is "right now" — file is older, should NOT be included.
  const candidates = await ArtifactDetector.listCandidates(dir, Date.now(), 50 * 1024 * 1024);
  assert.equal(candidates.length, 0);
});

test('respects size limit', async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, 'big.pdf'), Buffer.alloc(2048));

  // 1KB max — file is 2KB, should be skipped.
  const candidates = await ArtifactDetector.listCandidates(dir, 0, 1024);
  assert.equal(candidates.length, 0);
});

test('skips dotfiles and node_modules', async () => {
  const dir = await makeTmpDir();
  await fs.mkdir(path.join(dir, 'node_modules'));
  await fs.writeFile(path.join(dir, 'node_modules', 'noise.pdf'), 'n');
  await fs.mkdir(path.join(dir, '.git'));
  await fs.writeFile(path.join(dir, '.git', 'hidden.pdf'), 'h');
  await fs.writeFile(path.join(dir, 'real.pdf'), 'r');

  const candidates = await ArtifactDetector.listCandidates(dir, 0, 50 * 1024 * 1024);
  const names = candidates.map(c => path.basename(c.path));
  assert.deepEqual(names, ['real.pdf']);
});
```

- [ ] **Step 3: Run the test**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsx --test src/services/__tests__/artifact-detector.test.ts
```

Expected: 5 tests pass. If `tsx --test` fails because the flag isn't recognized in the installed `tsx` version, fall back to:

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsx node:test src/services/__tests__/artifact-detector.test.ts
```

If that also fails, compile to JS first: `npx tsc --noEmit false --outDir /tmp/at-build src/services/artifact-detector.service.ts src/services/__tests__/artifact-detector.test.ts && node --test /tmp/at-build/services/__tests__/artifact-detector.test.js`.

- [ ] **Step 4: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/artifact-detector.service.ts backend/src/services/__tests__/artifact-detector.test.ts
git commit -m "test(artifact-detector): cover extension filter / size limit / sinceMs / dotfile skip"
```

---

### Task 8: Wire `ArtifactDetector` into `ToolExecutor`

**Files:**
- Modify: `backend/src/workspace/tool-executor.ts`

- [ ] **Step 1: Update the constructor signature**

Open `backend/src/workspace/tool-executor.ts`. Add an `ArtifactDetector` import at the top:

```ts
import { ArtifactDetector } from '../services/artifact-detector.service';
```

Modify the constructor to accept an optional detector. Inside the class:

```ts
  constructor(
    private fileService: FileService,
    private commandService: ICommandService,
    private gitService?: GitService,
    private webSearchService?: WebSearchService,
    private dockerService?: DockerService,
    private sessionId?: string,
    private callbacks?: {
      addTaskComment?: (content: string, type?: string) => Promise<void>;
      getTaskComments?: (limit?: number) => Promise<any[]>;
    },
    private sandboxed: boolean = false,
    private artifactDetector?: ArtifactDetector,
  ) {}
```

- [ ] **Step 2: Add helper that triggers detector after relevant tools**

Inside the class, add this private method:

```ts
  private async maybeDetectArtifacts(toolName: string): Promise<void> {
    if (!this.artifactDetector) return;
    if (!['write_file', 'execute_code', 'run_command'].includes(toolName)) return;
    try {
      await this.artifactDetector.scanAndRegister();
    } catch (err) {
      console.error('[ToolExecutor] ArtifactDetector scan failed (non-fatal):', err);
    }
  }
```

- [ ] **Step 3: Call helper after the three relevant tool branches**

Find the `case 'write_file':` block (around line 41). After the existing `return` line, **change** the block from `return { success: ... }` to capture-then-detect-then-return. Replace:

```ts
        case 'write_file':
          await this.fileService.writeFile(args.path, args.content);
          return { success: true, output: `File ${args.path} written successfully.` };
```

With:

```ts
        case 'write_file': {
          await this.fileService.writeFile(args.path, args.content);
          await this.maybeDetectArtifacts('write_file');
          return { success: true, output: `File ${args.path} written successfully.` };
        }
```

Find the `case 'run_command':` block (around line 58). Replace:

```ts
        case 'run_command':
          if (!this.sandboxed) {
            return {
              success: false,
              output: 'run_command requires a Docker sandbox which is not available in this session. Use write_file to create files and deliver them via task_complete.',
            };
          }
          const cmdResult = await this.commandService.runCommand(args.command, args.timeout);
          return {
            success: cmdResult.exitCode === 0,
            output: `STDOUT:\n${cmdResult.stdout}\n\nSTDERR:\n${cmdResult.stderr}`,
          };
```

With:

```ts
        case 'run_command': {
          if (!this.sandboxed) {
            return {
              success: false,
              output: 'run_command requires a Docker sandbox which is not available in this session. Use write_file to create files and deliver them via task_complete.',
            };
          }
          const cmdResult = await this.commandService.runCommand(args.command, args.timeout);
          await this.maybeDetectArtifacts('run_command');
          return {
            success: cmdResult.exitCode === 0,
            output: `STDOUT:\n${cmdResult.stdout}\n\nSTDERR:\n${cmdResult.stderr}`,
          };
        }
```

Find the `case 'execute_code':` block (around line 122). At the very end of the block (after the final `return { success: ..., output: ... }` of that case), inject the detector call right before the return:

```ts
          await this.maybeDetectArtifacts('execute_code');
          return {
            success: execResult.exitCode === 0,
            output: `STDOUT:\n${execResult.stdout}\n\nSTDERR:\n${execResult.stderr}`,
          };
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace/tool-executor.ts
git commit -m "feat(tool-executor): trigger ArtifactDetector after write_file/execute_code/run_command"
```

---

### Task 9: Construct `ArtifactDetector` in the agentic loop

**Files:**
- Modify: `backend/src/agents/agentic-loop.ts`

- [ ] **Step 1: Import the detector**

At the top of `backend/src/agents/agentic-loop.ts`, add:

```ts
import { ArtifactDetector } from '../services/artifact-detector.service';
```

- [ ] **Step 2: Construct it inside `executeAgenticTask` and pass to ToolExecutor**

Find the `new ToolExecutor(...)` call (around line 539). Just before it, add:

```ts
  const taskStartedAt = Date.now();
  const artifactDetector = new ArtifactDetector(
    workspaceDir,
    sessionId,
    taskId,
    agentType,
    taskStartedAt,
  );
```

Then update the `ToolExecutor` instantiation to pass the detector as the final argument:

```ts
  const toolExecutor = new ToolExecutor(
    fileService,
    commandService,
    gitService || undefined,
    webSearchService,
    dockerServiceInstance,
    sessionId,
    {
      addTaskComment: async (content: string, type?: string) => { /* unchanged */ },
      getTaskComments: async (limit?: number) => { /* unchanged */ },
    },
    !!containerId,
    artifactDetector,
  );
```

(Leave the callbacks block exactly as it was — only add the trailing `artifactDetector` argument.)

- [ ] **Step 3: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agents/agentic-loop.ts
git commit -m "feat(agentic-loop): construct ArtifactDetector and pass it to ToolExecutor"
```

---

### Task 10: Provision a sandbox for non-project sessions

**Files:**
- Modify: `backend/src/orchestrator/orchestrator.ts`

Today, the orchestrator only provisions a Docker sandbox when `projectId` is set (around lines 215–260). For ad-hoc "give me a PDF" sessions there's no project, so the agent has no `containerId` and can't run Python. Add a fallback branch.

- [ ] **Step 1: Add the fallback branch**

Locate the existing `if (projectId) { ... }` block that handles Mission Control provisioning (line ~215). Immediately after its closing `}`, add an `else` branch:

```ts
    } else {
      // Non-project session — provision a basic sandbox so the agent can execute_code / run_command.
      try {
        emitSSE(sessionId, {
          type: 'sandbox_starting',
          sessionId,
          message: 'Starting sandbox…',
        });

        containerId = await provisioner.provisionWorkspace(
          sessionId,
          effectiveWorkspaceDir,
          undefined,
          'main'
        );
        await updateSessionContainerId(sessionId, containerId);

        emitSSE(sessionId, {
          type: 'sandbox_ready',
          sessionId,
          containerId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Orchestrator] Sandbox provisioning unavailable for non-project session ${sessionId}: ${msg}`);
        containerId = null;
        // Do NOT fail the session — file-only tasks can still proceed without a sandbox.
      }
    }
```

(If the existing `if (projectId)` block doesn't already have a clear closing brace where you can chain `else`, refactor the existing block first so the closing `}` is on its own line. Don't change the existing logic, only add the else branch.)

- [ ] **Step 2: Verify cleanup still fires**

The existing `finally` block at lines ~348–355 already calls `destroySandbox(containerId)`. Confirm by reading it. No change required — the fallback `containerId` will be cleaned up by the same finally.

If there's a separate Mission Control teardown path (`stopMissionControl`), make sure it only fires when `projectId` was set. Skim the `finally` block. If it always calls `stopMissionControl` even for non-project sessions, wrap that call in `if (projectId)`. Otherwise leave it.

- [ ] **Step 3: Add `sandbox_starting` emit for project sessions too**

For UX consistency, just before the existing `provisioner.provisionWorkspace(...)` call in the `if (projectId)` branch (line ~221), add:

```ts
        emitSSE(sessionId, {
          type: 'sandbox_starting',
          sessionId,
          message: 'Starting sandbox…',
        });
```

And after the successful Mission Control container ID retrieval (line ~246, after `containerId = await dockerService.getMissionControlContainerId(...)`), add:

```ts
        emitSSE(sessionId, {
          type: 'sandbox_ready',
          sessionId,
          containerId: containerId || '',
        });
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/orchestrator/orchestrator.ts
git commit -m "feat(orchestrator): provision sandbox for non-project sessions and emit sandbox_starting/_ready"
```

---

### Task 11: Implement download + list endpoints

**Files:**
- Create: `backend/src/controllers/artifact.controller.ts`
- Create: `backend/src/routes/artifact.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Write the controller**

Create `backend/src/controllers/artifact.controller.ts`:

```ts
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import {
  getArtifactById,
  getArtifactsBySession,
} from '../db/queries';

export async function downloadArtifact(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const artifact = await getArtifactById(id);
  if (!artifact) {
    res.status(404).json({ error: 'Artifact not found' });
    return;
  }
  if (Date.now() > artifact.expires_at) {
    res.status(410).json({ error: 'Artifact has expired' });
    return;
  }
  try {
    await fsp.access(artifact.host_path, fs.constants.R_OK);
  } catch {
    res.status(404).json({ error: 'Artifact file missing on disk' });
    return;
  }

  res.setHeader('Content-Type', artifact.mime_type);
  res.setHeader('Content-Length', String(artifact.size_bytes));
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeFilename(artifact.filename)}"`
  );

  const stream = fs.createReadStream(artifact.host_path);
  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Read failed', message: err.message });
    } else {
      res.destroy(err);
    }
  });
  stream.pipe(res);
}

export async function listSessionArtifacts(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const artifacts = await getArtifactsBySession(sessionId);
  res.json(artifacts.map(a => ({
    id: a.id,
    sessionId: a.session_id,
    taskId: a.task_id,
    agentType: a.agent_type,
    filename: a.filename,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    createdAt: a.created_at,
    expiresAt: a.expires_at,
    downloadUrl: `/api/artifacts/${a.id}/download`,
  })));
}

// RFC 5987 + ASCII fallback so non-ASCII filenames don't break Content-Disposition.
function encodeFilename(name: string): string {
  // Replace any character outside basic ASCII printable with underscore for the legacy fallback.
  return name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
}
```

- [ ] **Step 2: Write the routes file**

Create `backend/src/routes/artifact.routes.ts`:

```ts
import { Router } from 'express';
import { downloadArtifact, listSessionArtifacts } from '../controllers/artifact.controller';

const router = Router();

router.get('/:id/download', downloadArtifact);
router.get('/session/:sessionId', listSessionArtifacts);

export default router;
```

- [ ] **Step 3: Mount routes in the index**

Read `backend/src/routes/index.ts` and follow the existing pattern. Add an import:

```ts
import artifactRoutes from './artifact.routes';
```

Then mount it:

```ts
router.use('/artifacts', artifactRoutes);
```

(Place it next to other `router.use(...)` calls.)

- [ ] **Step 4: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke-test the endpoint**

Start the backend (`cd backend && npm run dev`). In another shell:

```bash
curl -i http://localhost:3001/api/artifacts/non-existent-id/download
```

Expected: `HTTP/1.1 404 Not Found` with JSON body `{"error":"Artifact not found"}`. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/artifact.controller.ts backend/src/routes/artifact.routes.ts backend/src/routes/index.ts
git commit -m "feat(api): add GET /api/artifacts/:id/download and /api/artifacts/session/:sessionId"
```

---

### Task 12: Retention cron — delete expired artifacts

**Files:**
- Create: `backend/src/services/artifact-retention.service.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Write the service**

Create `backend/src/services/artifact-retention.service.ts`:

```ts
import * as cron from 'node-cron';
import * as fs from 'fs/promises';
import { deleteArtifact, getExpiredArtifacts } from '../db/queries';

let scheduled: cron.ScheduledTask | null = null;

/** Idempotent: starts the daily 03:00 retention sweep. */
export function startArtifactRetentionCron(): void {
  if (scheduled) return;
  scheduled = cron.schedule('0 3 * * *', runOnce, { timezone: undefined });
  console.log('[ArtifactRetention] Scheduled daily sweep at 03:00');
}

/** Exported so an integration test / admin endpoint can trigger it on demand. */
export async function runOnce(): Promise<{ deleted: number; failed: number }> {
  const now = Date.now();
  const expired = await getExpiredArtifacts(now);
  let deleted = 0;
  let failed = 0;
  for (const a of expired) {
    try {
      await fs.unlink(a.host_path).catch(() => { /* file may already be gone — fine */ });
      await deleteArtifact(a.id);
      deleted++;
    } catch (err) {
      console.error(`[ArtifactRetention] Failed to delete artifact ${a.id}:`, err);
      failed++;
    }
  }
  if (deleted > 0 || failed > 0) {
    console.log(`[ArtifactRetention] Sweep complete: deleted=${deleted} failed=${failed}`);
  }
  return { deleted, failed };
}
```

- [ ] **Step 2: Start cron from server.ts**

Open `backend/src/server.ts`. After the existing migrations call and server startup, add:

```ts
import { startArtifactRetentionCron } from './services/artifact-retention.service';

// ... after migrations + server.listen(...)
startArtifactRetentionCron();
```

(Position it next to any other cron-starting code if present, e.g. the heartbeat service init.)

- [ ] **Step 3: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/artifact-retention.service.ts backend/src/server.ts
git commit -m "feat: add daily artifact retention cron"
```

---

### Task 13: Tighten Coder agent prompt for file deliverables

**Files:**
- Modify: `backend/src/agents/coder.agent.ts`

- [ ] **Step 1: Replace the Mode A block**

Open `backend/src/agents/coder.agent.ts`. Find the existing `### Mode A: FILE DELIVERABLE (...)` section (lines 23-38). Replace the entire block — from `### Mode A: FILE DELIVERABLE` through the line before `### Mode B: APPLICATION CODE` — with:

```ts
### Mode A: FILE DELIVERABLE (PDF, Excel, Word, charts, images)
When the task asks for a downloadable file, use \`execute_code\` with \`language: "python"\` to write the actual binary file to the working directory (\`/workspace\`).

Available Python libraries: \`reportlab\`, \`fpdf2\`, \`openpyxl\`, \`xlsxwriter\`, \`python-docx\`, \`python-pptx\`, \`pandas\`, \`numpy\`, \`matplotlib\`, \`pillow\`.

The system **auto-detects** any new file matching \`.pdf .xlsx .docx .pptx .csv .png .jpg .jpeg .svg .gif\` extensions and registers it as a downloadable artifact. The user automatically sees a download link in the UI — you do NOT need to call any registration tool.

Workflow:
1. Pick the right library for the format (e.g. \`reportlab\` for PDF, \`openpyxl\` for XLSX, \`python-docx\` for DOCX).
2. Write Python that produces the file at a meaningful filename like \`report.pdf\` or \`q3-sales.xlsx\` in the current directory.
3. Call \`execute_code\` with that Python. Confirm \`exitCode === 0\` and that stderr is empty/informational.
4. If the script failed, fix the code and re-run \`execute_code\`. Do not give up after one failure.
5. Call \`task_complete\` with a one-line summary that mentions the produced filename.

**Do not** produce a code-only "here's a script you could run" deliverable when the user asked for the file itself.
```

(Keep the surrounding backticks and template-literal escapes correct — this is being injected into a TypeScript template string.)

- [ ] **Step 2: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/agents/coder.agent.ts
git commit -m "feat(coder): tighten Mode A prompt for auto-detected file artifacts"
```

---

### Task 14: Frontend — types and SSE handling

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/store/sessionStore.ts`
- Modify: `frontend/src/hooks/useSSE.ts`

- [ ] **Step 1: Mirror types**

Open `frontend/src/types/index.ts`. Add (near the other backend-mirroring interfaces):

```ts
export interface Artifact {
  id: string;
  sessionId: string;
  taskId: string | null;
  agentType: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  expiresAt: number;
  downloadUrl: string;
}

export interface SSEArtifactCreatedEvent {
  type: 'artifact_created';
  sessionId: string;
  taskId: string | null;
  artifactId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  agentType: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface SSESandboxStartingEvent {
  type: 'sandbox_starting';
  sessionId: string;
  message: string;
}

export interface SSESandboxReadyEvent {
  type: 'sandbox_ready';
  sessionId: string;
  containerId: string;
}
```

If the frontend has an `SSEEvent` union mirroring the backend's, add `| SSEArtifactCreatedEvent | SSESandboxStartingEvent | SSESandboxReadyEvent` to it.

- [ ] **Step 2: Update sessionStore**

Open `frontend/src/store/sessionStore.ts`. Add to the store state:

```ts
artifacts: Record<string, Artifact[]>;  // keyed by taskId; null taskId → key '__session__'
sandboxStatus: 'idle' | 'starting' | 'ready' | 'unavailable';
```

Add an action:

```ts
upsertArtifact: (artifact: Artifact) => set(state => {
  const key = artifact.taskId ?? '__session__';
  const existing = state.artifacts[key] ?? [];
  if (existing.some(a => a.id === artifact.id)) return state;
  return {
    artifacts: { ...state.artifacts, [key]: [...existing, artifact] },
  };
}),
setSandboxStatus: (status: 'idle' | 'starting' | 'ready' | 'unavailable') => set({ sandboxStatus: status }),
```

Initialize `artifacts: {}` and `sandboxStatus: 'idle'` in the default state. Reset both on session start/stop, matching whatever pattern the store already uses for other per-session state.

- [ ] **Step 3: Handle new SSE events in useSSE**

Open `frontend/src/hooks/useSSE.ts`. Find the `handleMessage` switch. Add three new cases:

```ts
case 'artifact_created': {
  const ev = data as SSEArtifactCreatedEvent;
  upsertArtifact({
    id: ev.artifactId,
    sessionId: ev.sessionId,
    taskId: ev.taskId,
    agentType: ev.agentType,
    filename: ev.filename,
    mimeType: ev.mimeType,
    sizeBytes: ev.sizeBytes,
    createdAt: ev.createdAt,
    expiresAt: ev.expiresAt,
    downloadUrl: ev.downloadUrl,
  });
  // Also surface in the live feed:
  feedStore.getState().push({ kind: 'artifact', event: ev });
  break;
}
case 'sandbox_starting': {
  setSandboxStatus('starting');
  break;
}
case 'sandbox_ready': {
  setSandboxStatus('ready');
  break;
}
```

(Import the types and store actions at the top of the file. Follow the existing pattern in this file for `feedStore.getState().push(...)` — if the feed-store API differs, match it.)

- [ ] **Step 4: Type-check frontend**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/store/sessionStore.ts frontend/src/hooks/useSSE.ts
git commit -m "feat(frontend): plumb Artifact type, store action, and SSE handlers"
```

---

### Task 15: Build `ArtifactChip` component

**Files:**
- Create: `frontend/src/components/ArtifactChip.tsx`

- [ ] **Step 1: Write the chip**

Create `frontend/src/components/ArtifactChip.tsx`:

```tsx
import React from 'react';
import { Artifact } from '../types';
import { Download, FileText, FileSpreadsheet, FileImage, FileType2 } from 'lucide-react';

interface Props {
  artifact: Artifact;
  apiBaseUrl?: string;
}

function iconFor(mimeType: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType.startsWith('image/')) return FileImage;
  if (['xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['docx', 'pptx'].includes(ext)) return FileType2;
  return FileText;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ArtifactChip: React.FC<Props> = ({ artifact, apiBaseUrl }) => {
  const Icon = iconFor(artifact.mimeType, artifact.filename);
  const base = apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const href = `${base}${artifact.downloadUrl}`;
  return (
    <a
      href={href}
      download={artifact.filename}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700
                 border border-slate-200 dark:border-slate-700
                 text-sm font-medium transition-colors no-underline"
      title={`Download ${artifact.filename} (${formatSize(artifact.sizeBytes)})`}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate max-w-[20ch]">{artifact.filename}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {formatSize(artifact.sizeBytes)}
      </span>
      <Download size={14} className="shrink-0 opacity-60" />
    </a>
  );
};
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/frontend && npx tsc --noEmit
```

Expected: no errors. If `lucide-react` isn't installed, check `frontend/package.json` — it likely already is (other components use it). If not, install: `cd frontend && npm install lucide-react`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ArtifactChip.tsx
git commit -m "feat(frontend): add ArtifactChip download component"
```

---

### Task 16: Render chips inside `TaskCard`

**Files:**
- Modify: `frontend/src/components/TaskCard.tsx`

- [ ] **Step 1: Render chips at the bottom of the card**

Open `frontend/src/components/TaskCard.tsx`. Near the top, import:

```tsx
import { ArtifactChip } from './ArtifactChip';
import { useSessionStore } from '../store/sessionStore';
```

Inside the component, after extracting the task prop, select the artifacts for this task:

```tsx
const artifacts = useSessionStore(state => state.artifacts[task.id] ?? []);
```

In the JSX, find the bottom of the card (after the existing output / footer area). Append:

```tsx
{artifacts.length > 0 && (
  <div className="mt-3 flex flex-wrap gap-2">
    {artifacts.map(a => <ArtifactChip key={a.id} artifact={a} />)}
  </div>
)}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TaskCard.tsx
git commit -m "feat(frontend): show ArtifactChips inside TaskCard"
```

---

### Task 17: Render artifact events in `LiveFeed`

**Files:**
- Modify: `frontend/src/components/LiveFeed.tsx`

- [ ] **Step 1: Read the feed renderer**

Read the file to understand how feed items are dispatched to renderers:

```bash
cat frontend/src/components/LiveFeed.tsx | head -150
```

Note the discriminator pattern (likely a `switch` on `item.kind` or `item.type`).

- [ ] **Step 2: Add a renderer for artifact events**

Wherever the switch lives, add a new case. Use `ArtifactChip` for the link. Example shape (adapt to the file's exact conventions):

```tsx
case 'artifact_created': {
  const ev = item.event as SSEArtifactCreatedEvent;
  // Build a transient artifact object for the chip (id is needed):
  const artifact: Artifact = {
    id: ev.artifactId,
    sessionId: ev.sessionId,
    taskId: ev.taskId,
    agentType: ev.agentType,
    filename: ev.filename,
    mimeType: ev.mimeType,
    sizeBytes: ev.sizeBytes,
    createdAt: ev.createdAt,
    expiresAt: ev.expiresAt,
    downloadUrl: ev.downloadUrl,
  };
  return (
    <div key={item.id} className="flex items-center gap-2 py-1.5 text-sm">
      <Paperclip size={14} className="opacity-60" />
      <span className="text-slate-600 dark:text-slate-300">
        {ev.agentType ?? 'Agent'} produced
      </span>
      <ArtifactChip artifact={artifact} />
    </div>
  );
}
```

(Import `Paperclip` from `lucide-react`, `ArtifactChip` from `./ArtifactChip`, and the types from `../types`.)

If `feedStore` uses a different push shape than `{ kind: 'artifact', event: ev }` from Task 14 Step 3, reconcile both files now — pick the shape that matches the existing feed-item discriminator.

- [ ] **Step 3: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LiveFeed.tsx
git commit -m "feat(frontend): render artifact_created events in LiveFeed"
```

---

### Task 18: Add "Generated files" section to final report

**Files:**
- Modify: whichever component renders the `session_complete` final report (search the codebase to find it)

- [ ] **Step 1: Locate the final-report renderer**

Run:

```bash
grep -rn "session_complete\|final_report" frontend/src --include="*.tsx" --include="*.ts"
```

The match in a `.tsx` file rendering markdown is the target.

- [ ] **Step 2: Append a Generated files section**

In that component, select all artifacts for the session:

```tsx
const allArtifacts = useSessionStore(state => {
  const map = state.artifacts;
  return Object.values(map).flat();
});
```

After the rendered markdown report, append:

```tsx
{allArtifacts.length > 0 && (
  <section className="mt-6">
    <h3 className="text-base font-semibold mb-2">Generated files</h3>
    <div className="flex flex-wrap gap-2">
      {allArtifacts.map(a => <ArtifactChip key={a.id} artifact={a} />)}
    </div>
  </section>
)}
```

Import `ArtifactChip` and `useSessionStore` if not already imported.

- [ ] **Step 3: Type-check**

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/<the-file>.tsx
git commit -m "feat(frontend): list generated files in session final report"
```

---

### Task 19: Manual end-to-end verification

Run through the test cases from the spec. Boot everything:

```bash
cd /Users/navdeepvala/Documents/Coding/Vide-coded-projects/AgentForge && npm run dev
```

For each case, in the UI: open a new session (NO project attached), type the goal, and watch.

- [ ] **PDF golden path**

Goal: `Generate a 3-page PDF report about the Mars rover Curiosity.`

Verify:
- Live feed shows `sandbox_starting` then `sandbox_ready`.
- Coder task appears, runs `execute_code` (visible in agent_tool_use events).
- `artifact_created` fires; chip appears on Coder's task card.
- LiveFeed shows "📎 coder produced report.pdf".
- Click the chip → browser downloads a valid 3-page PDF.

- [ ] **Excel golden path**

Goal: `Make me a sales-by-month spreadsheet for FY24 with sample data and a chart.`

Verify: `.xlsx` chip appears, downloads, opens cleanly in Excel/Numbers/LibreOffice.

- [ ] **Word golden path**

Goal: `Write a 2-page memo about Q3 results as a Word doc.`

Verify: `.docx` chip appears, downloads, opens cleanly.

- [ ] **Multi-artifact**

Goal: `Generate a sales PDF and the matching Excel spreadsheet.`

Verify: two chips on the same Coder task card; both download cleanly; final report's "Generated files" lists both.

- [ ] **Existing-project regression**

Pick an existing project session that historically worked (no file deliverables). Run a typical task. Confirm: nothing breaks, no spurious artifacts, no errors in the backend log.

- [ ] **Retention sweep**

Stop the backend. Set `ARTIFACT_RETENTION_DAYS=0` in `backend/.env`. Restart. In `mysql`:

```sql
SELECT id, filename, created_at, expires_at FROM artifacts ORDER BY created_at DESC LIMIT 5;
```

Confirm `expires_at <= now`. Trigger an immediate run by adding a one-off script:

```bash
cd backend && npx tsx -e "import('./src/services/artifact-retention.service').then(m => m.runOnce()).then(r => console.log(r))"
```

Expected: prints `{ deleted: N, failed: 0 }`. Re-query MySQL — rows for those artifacts are gone. `ls` the workspace dir — corresponding files are gone too. Restore `ARTIFACT_RETENTION_DAYS=30`.

- [ ] **Expired-download response**

Pick a row that was just deleted (use a stale `id` from the previous query) and hit:

```bash
curl -i http://localhost:3001/api/artifacts/<deleted-id>/download
```

Expected: `HTTP/1.1 404 Not Found`. (Or `410` if you can find an artifact whose row still exists but `expires_at < now` — the 410 path is logically reachable but the cron deletes both DB row and file together, so 404 is the more common observation.)

- [ ] **Sandbox-unavailable failure mode**

Stop Docker Desktop. Start a new non-project session with a file-deliverable goal. Expected: the session does NOT crash; the agent reports a clear error in the task output (mentioning that the sandbox is unavailable). Restart Docker.

- [ ] **Type-check the full project once more**

```bash
cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit
```

Expected: no errors anywhere.

---

### Task 20: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add an "Artifacts" subsection under Architecture**

Open `CLAUDE.md`. Under the `### Backend` section, after the `**Database** ...` paragraph, add:

```markdown
**Artifacts (generated downloadable files):**
When the Coder agent (or any agent) writes a file matching `.pdf .xlsx .docx .pptx .csv .png .jpg .jpeg .svg .gif` extensions into the session's workspace, `ArtifactDetector` (in `services/artifact-detector.service.ts`) auto-registers it in the `artifacts` table and emits an `artifact_created` SSE event. The frontend renders a download chip on the task card, in the LiveFeed, and in the final report. Files are streamed via `GET /api/artifacts/:id/download`. A daily cron deletes artifacts older than `ARTIFACT_RETENTION_DAYS` (default 30).
```

Update the "Schema tables" line at the end of the database paragraph to include `artifacts`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document artifact auto-detection in CLAUDE.md"
```

---

## Self-review

**Spec coverage:**
- Sandbox Dockerfile → Task 1 ✓
- Per-session workspace bootstrap → orchestrator already creates `/tmp/agentforge/sessions/<sessionId>` at line 76; Task 10 confirms sandbox provisioning for those sessions ✓
- Lazy sandbox in ToolExecutor → adjusted to per-session provisioning in orchestrator (Task 10) because the orchestrator already owns container lifecycle; outcome (sandbox available when agent needs it) is identical ✓
- Artifact auto-detection → Tasks 6, 7, 8, 9 ✓
- artifacts DB table → Task 2 ✓
- Download endpoint → Task 11 ✓
- New SSE events → Task 3 (backend types), Task 14 (frontend wiring) ✓
- Retention cron → Task 12 ✓
- Frontend: ArtifactChip → Task 15; TaskCard → 16; LiveFeed → 17; final report → 18 ✓
- Coder prompt tweak → Task 13 ✓
- Error handling: Docker unreachable (Task 10 try/catch), size limit (Task 6), file missing (Task 11), expired (Task 11), idempotent insert (Task 4 ON DUPLICATE KEY UPDATE) ✓
- Testing: Task 7 (unit), Task 19 (manual) ✓
- CLAUDE.md update → Task 20 ✓

**Placeholder scan:** No "TBD" or "TODO" markers. Two places direct the engineer to "find and follow the existing pattern" (env.ts in Task 5, final-report renderer in Task 18) — both because the patterns vary by file and the engineer needs to read the file to match style. That's a documented action, not a placeholder.

**Type consistency:**
- `Artifact` interface shape consistent between Tasks 3 (backend type), 4 (queries), 6 (detector), 11 (controller serialization), 14 (frontend mirror).
- `SSEArtifactCreatedEvent` fields (`sessionId / taskId / artifactId / filename / mimeType / sizeBytes / downloadUrl / agentType / createdAt / expiresAt`) match between Tasks 3, 6 (emitter), 14 (frontend type), 17 (LiveFeed renderer).
- `upsertArtifact` action signature consistent between Tasks 14 and 16.
- `scanAndRegister` and `listCandidates` signatures consistent between Tasks 6, 7, 8.

**Variance from spec, called out:**
- Spec said "lazy in ToolExecutor". Implementation is per-session provisioning in orchestrator (Task 10). User-observable behavior is the same (sandbox available when the agent first calls `execute_code`), but the lifecycle is owned by the orchestrator which already has a clean teardown path. This is simpler than retrofitting lazy provisioning into ToolExecutor and is consistent with how the codebase manages containers today.

Plan is consistent and complete.
