# Implementation Plan: Docker-Based Sandbox Execution for AgentForge

## Executive Summary

AgentForge already has:
- Multi-agent orchestration (Jarvis, Researcher, Coder, Tester, R&D)
- Tool execution framework (`agentic-loop.ts`, `ToolExecutor`, `FileService`, `CommandService`)
- Workspace management (local filesystem operations)
- Project & session models with workspace_dir support
- SSE streaming for real-time updates

**Missing**: Docker-based isolated execution. Currently `CommandService` uses `child_process.exec` directly on the host machine — a security risk and not isolated.

**Goal**: Replace direct host execution with Docker container-based sandboxes. Each session gets its own container with the workspace mounted. All commands, git operations, and file edits happen inside the container.

---

## Current Architecture Assessment

### Existing Components

1. **WorkspaceManager** (`workspace/workspace.manager.ts`)
   - Resolves safe paths within workspace root
   - Provides project tree generation
   - Operates on local filesystem directly

2. **FileService** (`workspace/file.service.ts`)
   - readFile, writeFile, listDirectory, deleteFile, exists
   - Uses Node.js `fs/promises`
   - Already validated with `resolveSafePath()` — safe from path traversal

3. **CommandService** (`workspace/command.service.ts`)
   - **PROBLEM**: Uses `child_process.exec` directly on host
   - Has an allowed-commands whitelist (npm, npx, node, git, ls, cat, grep, find, mkdir, touch, rm, cp, mv)
   - But still runs on host — no isolation, can access host filesystem

4. **ToolExecutor** (`workspace/tool-executor.ts`)
   - Dispatches to FileService and CommandService based on tool name
   - No git-specific tool yet

5. **Agentic Loop** (`agents/agentic-loop.ts`)
   - Already designed to accept `workspaceDir` parameter
   - Creates FileService and CommandService instances with that workspace
   - Called from `agent.registry.ts` when `workspaceDir` is provided

6. **Orchestrator** (`orchestrator/orchestrator.ts`)
   - `startSession()` receives optional `workspaceDir` from controller
   - Passes it to `executeAgentTask()` → `executeAgenticTask()`
   - Sessions table has `workspace_dir` column

7. **Projects** (database)
   - Projects have `workspace_path` and `repo_url` fields
   - But currently the repo is only fetched as context (read-only via GitHub API)
   - **No actual git clone happens** — agents work on empty/local workspaces

---

## Design Goals for Docker Integration

**Isolation**: Each session gets its own container. No shared filesystem with host except via explicit volume mounts.

**Security**: Non-root user inside container. Resource limits (CPU/memory). No privileged mode.

**Persistence**: Workspace volumes persist between container restarts. Container can be stopped/started.

**Cleanup**: When session ends (complete/cancel/fail), container is stopped and removed. Workspace directory can be kept or deleted based on config.

**Seamless integration**: Existing FileService and ToolExecutor should work with minimal changes. Only CommandService needs to change to use `docker exec`.

**Git operations**: Add dedicated GitService that runs git commands inside the container (using the same docker exec mechanism).

**Repo provisioning**: When a project has a `repo_url`, the workspace should be initialized by cloning that repo into the workspace directory (inside the container on first start, or on host then mounted).

---

## Implementation Phases

---

### Phase 1: Docker Infrastructure Setup

**Files to create**:
- `backend/src/sandbox/Dockerfile`
- `backend/src/sandbox/docker-compose.yml` (optional, for local dev)
- `backend/src/sandbox/docker.service.ts` — Dockerode management

**Step 1.1: Dockerfile**

Create a reusable sandbox image with common dev tools:

```dockerfile
FROM node:20-bookworm-slim

# Install common tools
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    php \
    composer \
    curl \
    wget \
    jq \
    less \
    vim-tiny \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash sandbox
USER sandbox
WORKDIR /workspace

# Default: keep container alive
CMD ["sleep", "infinity"]
```

**Rationale**:
- `node:20-bookworm-slim` gives us Node.js 20 + npm
- Git for version control operations
- Python & PHP to support those language ecosystems
- `sleep infinity` keeps container running; we'll exec commands into it
- Non-root user `sandbox` (UID 1000) prevents privilege escalation

**Step 1.2: Dockerode Integration**

Install dependency:
```bash
cd backend && npm install dockerode
```

Create `backend/src/sandbox/docker.service.ts`:

```typescript
import Docker from 'dockerode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SandboxConfig {
  workspacePath: string;  // Host path to workspace directory
  containerName: string;  // Unique container name
  memoryLimit?: number;   // in MB
  cpuLimit?: number;      // number of CPUs (fraction allowed)
}

export class DockerService {
  private docker: Docker;
  private containers: Map<string, Docker.Container>; // sessionId -> container

  constructor() {
    this.docker = new Docker();
    this.containers = new Map();
  }

  async createSandbox(config: SandboxConfig): Promise<string> {
    // 1. Ensure workspace exists on host
    await fs.mkdir(config.workspacePath, { recursive: true });

    // 2. Create container with volume mount
    const container = await this.docker.createContainer({
      name: config.containerName,
      Image: 'agentforge-sandbox:latest', // Built from Dockerfile
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Binds: [`${config.workspacePath}:/workspace`],
        Memory: config.memoryLimit * 1024 * 1024 || 1024 * 1024 * 1024, // 1GB default (needed for Chrome)
        CpuPeriod: 100000,
        CpuQuota: Math.round((config.cpuLimit || 1.0) * 100000), // 1.0 CPU default
        NetworkMode: 'bridge', // Allow outbound network for npm install, browser tests
        // Could add readonly rootfs except /workspace
      },
      User: '1000', // Run as sandbox user
      WorkingDir: '/workspace',
      Labels: {
        'agentforge.session': config.containerName, // session id
        'managed-by': 'agentforge',
      },
    });

    await container.start();
    this.containers.set(config.containerName, container);
    return container.id;
  }

  async startSandbox(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  async stopSandbox(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop();
  }

  async destroySandbox(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
    this.containers.delete(containerId);
  }

  async executeCommand(
    containerId: string,
    command: string[],
    options?: { timeout?: number; stream?: boolean }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const container = this.docker.getContainer(containerId);

    // Exec creates a new exec instance inside the running container
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    // Stream output
    const stream = await exec.start();
    const output: Buffer[] = [];
    const errorOutput: Buffer[] = [];

    // Wrap stream to capture stdout/stderr separately
    const stdoutStream = await exec.start({
      stream: true,
      stdout: true,
      stderr: true,
    });

    // Simple approach:缓冲所有数据
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      stdoutStream.on('data', (chunk: Buffer) => {
        // Docker multiplexes stdout/stderr; we rely on container's stream demux
        // In practice, we may need a proper demux. For simplicity, we'll capture raw.
        chunks.push(chunk);
      });

      stdoutStream.on('error', reject);
      stdoutStream.on('close', async () => {
        try {
          const result = await exec.inspect();
          const exitCode = result.ExitCode ?? 0;
          // Note: For production, use a proper demux stream to split stdout/stderr
          resolve({
            stdout: Buffer.concat(chunks).toString('utf-8'),
            stderr: '', // Placeholder — implement proper separation if needed
            exitCode,
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async getContainerLogs(containerId: string, tail?: number): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      tail: tail || 100,
      timestamps: false,
    });

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', () => resolve(''));
    });
  }

  async containerExists(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.inspect();
      return true;
    } catch {
      return false;
    }
  }
}
```

**Notes**:
- Uses Dockerode (official Docker SDK for Node.js)
- `docker` object connects to Docker daemon via Unix socket (`/var/run/docker.sock`)
- We mount the host workspace directory into `/workspace` in the container
- Container runs as non-root user (UID 1000)
- `exec` allows us to run arbitrary commands in the running container
- We'll build the image as `agentforge-sandbox:latest`

**Step 1.3: Dockerfile with Chrome & Puppeteer Dependencies**

Replace the simple Dockerfile with a comprehensive one that includes:
- Node.js 20, npm
- Git
- Chrome/Chromium browser with all dependencies
- Python3 & pip (for general scripting)
- PHP & Composer (if needed)
- Puppeteer and Playwright (and their browser dependencies)
- Common CLI tools (curl, wget, jq, unzip, etc.)

File: `backend/src/sandbox/Dockerfile`:

```dockerfile
FROM node:20-bookworm-slim

# ── System dependencies ────────────────────────────────────────────────────────
# Install Chrome/Chromium and all required libraries
RUN apt-get update && apt-get install -y \
    # Browser & dependencies
    chromium \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
    xdg-utils \
    # Dev tools
    git \
    python3 \
    python3-pip \
    php \
    composer \
    curl \
    wget \
    jq \
    unzip \
    zip \
    vim-tiny \
    less \
    # Additional libraries for headless Chrome
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome executable path for Puppeteer/Playwright
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Playwright browsers and dependencies (optional, user can do this too)
# We'll install playwright system-wide to make it available
RUN npm install -g playwright puppeteer && \
    playwright install --with-deps chromium && \
    rm -rf /root/.cache/ms-playwright

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash sandbox
USER sandbox
WORKDIR /workspace

# Default: keep container alive
CMD ["sleep", "infinity"]
```

**Key additions**:
- `chromium` package (Debian's headless Chrome)
- All required shared libraries for Chrome to run
- Global installation of `playwright` and `puppeteer` npm packages
- `playwright install` downloads Chromium and sets up system dependencies
- Environment variables point tools to Chrome binary
- Fonts for proper rendering

**Rationale for Chrome in the image**:
- Pre-installed ensures tester agent can run browser tests immediately
- Avoids per-session download overhead (~100MB)
- Guarantees consistent version across sessions
- Works offline once image is built

**Step 1.4: Build & Verification**

`backend/src/sandbox/build.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🔨 Building AgentForge sandbox image..."
docker build -t agentforge-sandbox:latest .

# Verify Chrome works
echo "✅ Verifying Chrome installation..."
docker run --rm agentforge-sandbox:latest chromium --version

echo "✅ Sandbox image built successfully!"
```

Add to root `package.json`:
```json
{
  "scripts": {
    "docker:build": "bash backend/src/sandbox/build.sh",
    "docker:test": "node backend/src/sandbox/docker.test.ts",
    "docker:clean": "docker rm -f $(docker ps -a -q --filter 'label=managed-by=agentforge') 2>/dev/null || true && docker rmi agentforge-sandbox:latest 2>/dev/null || true"
  }
}
```

Create quick test `backend/src/sandbox/docker.test.ts`:

```typescript
import Docker from 'dockerode';

const docker = new Docker();

async function test() {
  // Pull/built image check
  const image = await docker.listImages({ filters: { reference: ['agentforge-sandbox:latest'] } });
  if (image.length === 0) {
    console.error('❌ Image not found. Run npm run docker:build first');
    process.exit(1);
  }

  // Test container creation and command exec
  const container = await docker.createContainer({
    name: 'agentforge-test-' + Date.now(),
    Image: 'agentforge-sandbox:latest',
    HostConfig: { Binds: [] },
    WorkingDir: '/workspace',
  });

  await container.start();
  console.log('✅ Container started');

  const exec = await container.exec({
    Cmd: ['whoami'],
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ stream: true, stdout: true });
  let output = '';
  stream.on('data', (chunk: Buffer) => output += chunk.toString());

  await new Promise(resolve => stream.on('end', resolve));

  const info = await exec.inspect();
  console.log('Output:', output.trim());
  console.log('Exit code:', info.ExitCode);

  if (output.includes('sandbox') && info.ExitCode === 0) {
    console.log('✅ Running as non-root user sandbox');
  } else {
    console.error('❌ Wrong user');
  }

  await container.remove({ force: true });
  console.log('✅ Container cleaned up');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

---

### Phase 2: Git Operations Service

Create `backend/src/workspace/git.service.ts`:

```typescript
import { DockerService } from '../sandbox/docker.service';

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitService {
  constructor(
    private docker: DockerService,
    private containerId: string
  ) {}

  async clone(
    repoUrl: string,
    targetDir: string = '/workspace',
    branch?: string
  ): Promise<GitResult> {
    const args = ['git', 'clone'];
    if (branch) args.push('-b', branch);
    args.push(repoUrl, targetDir);
    return this.exec(args);
  }

  private async exec(args: string[]): Promise<GitResult> {
    return this.docker.executeCommand(this.containerId, args);
  }

  async status(cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'status', '--porcelain']);
  }

  async diff(cwd: string = '/workspace', filePath?: string): Promise<GitResult> {
    const cmd = ['-C', cwd, 'diff'];
    if (filePath) cmd.push(filePath);
    return this.exec(cmd);
  }

  async diffStaged(cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'diff', '--cached']);
  }

  async add(paths: string[], cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'add', ...paths]);
  }

  async commit(
    message: string,
    cwd: string = '/workspace',
    authorName: string = 'AgentForge',
    authorEmail: string = 'agent@agentforge.local'
  ): Promise<GitResult> {
    const env = {
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_COMMITTER_NAME: authorName,
      GIT_COMMITTER_EMAIL: authorEmail,
    };
    return this.docker.executeCommand(this.containerId, ['-C', cwd, 'commit', '-m', message], { env });
  }

  async log(cwd: string = '/workspace', limit: number = 10): Promise<GitResult> {
    return this.exec(['-C', cwd, 'log', '--oneline', `-n=${limit}`]);
  }

  async currentBranch(cwd: string = '/workspace'): Promise<string> {
    const result = await this.exec(['-C', cwd, 'branch', '--show-current']);
    return result.stdout.trim();
  }

  async isRepo(cwd: string = '/workspace'): Promise<boolean> {
    const result = await this.exec(['-C', cwd, 'rev-parse', '--is-inside-work-tree']);
    return result.stdout.trim() === 'true';
  }

  async init(cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'init']);
  }
}
```

---

### Phase 3: Docker-Aware CommandService

Modify `command.service.ts` to use Docker instead of direct exec.

**Option A**: Create new `DockerCommandService` that implements same interface
**Option B**: Refactor `CommandService` to accept a DockerService instance

**Recommended**: Create `SandboxCommandService` (new file) and deprecate the old one.

File: `backend/src/workspace/sandbox-command.service.ts`:

```typescript
import { DockerService } from '../sandbox/docker.service';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class SandboxCommandService {
  constructor(
    private docker: DockerService,
    private containerId: string
  ) {}

  async runCommand(
    command: string,
    timeout = 60000
  ): Promise<CommandResult> {
    // Split command into args (naive split — improve with proper shell parsing)
    const args = command.split(' ').filter(Boolean);

    // Docker exec with timeout
    const execCreate = await this.docker.getContainer(this.containerId).exec({
      Cmd: args,
      AttachStdout: true,
      AttachStderr: true,
    });

    // Stream with timeout
    const stream = await execCreate.start({ stream: true, stdout: true, stderr: true });

    return new Promise((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        // Attempt to kill the exec
        execCreate.kill().catch(() => {});
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      stream.on('data', (chunk: Buffer) => {
        if (timedOut) return;
        stdout.push(chunk);
      });

      stream.on('stderr', (chunk: Buffer) => {
        if (timedOut) return;
        stderr.push(chunk);
      });

      stream.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });

      stream.on('close', async () => {
        if (timedOut) return;
        clearTimeout(timeoutHandle);

        const info = await execCreate.inspect();
        const exitCode = info.ExitCode ?? 0;

        resolve({
          stdout: Buffer.concat(stdout).toString('utf-8'),
          stderr: Buffer.concat(stderr).toString('utf-8'),
          exitCode,
        });
      });
    });
  }
}
```

**Key changes**:
- `containerId` provided to constructor — service bound to a specific container for its lifetime
- Method signature simplified: `runCommand(command, timeout)` no longer needs containerId per call
- Uses `docker.exec` under the hood with proper stream separation (stdout/stderr events)
- Supports timeout with automatic kill
- No host filesystem access

---

### Phase 4: Workspace & Repository Initialization

**Problem**: Currently, workspace directories are created on host as plain folders. To make agents effective, we need to:
1. If project has `repo_url`, clone it into the workspace
2. This should happen when the sandbox container is first created
3. The cloned repo lives in the mounted volume, visible both to host (for file reading if needed) and inside container

**Solution**: Extend `DockerService` or create `WorkspaceProvisioner`:

File: `backend/src/workspace/workspace.provisioner.ts`:

```typescript
import { ensureDir } from 'fs-extra'; // or use fs/promises
import * as path from 'path';
import { DockerService } from '../sandbox/docker.service';
import { GitService } from '../workspace/git.service';

export class WorkspaceProvisioner {
  constructor(private docker: DockerService) {}

  async provisionWorkspace(
    sessionId: string,
    workspacePath: string,
    repoUrl?: string,
    branch?: string
  ): Promise<string> {
    // Ensure workspace dir exists on host
    await ensureDir(workspacePath);

    // Create and start container
    const containerId = await this.docker.createSandbox({
      workspacePath,
      containerName: `agentforge-${sessionId}`,
    });

    // If repoUrl provided, clone inside container
    if (repoUrl) {
      // Wait for container to be ready (simple sleep or health check)
      await new Promise((r) => setTimeout(r, 1000));

      // Create GitService bound to this container
      const git = new GitService(this.docker, containerId);
      try {
        await git.clone(repoUrl, '/workspace', branch);
      } catch (err) {
        // Clone failed — stop container and throw
        await this.docker.destroySandbox(containerId);
        throw new Error(`Failed to clone repository: ${err instanceof Error ? err.message : err}`);
      }
    }

    return containerId;
  }
}
```

---

### Phase 5: Integrating Sandbox into Orchestrator

**Changes needed in `orchestrator/orchestrator.ts`**:

Current flow:
1. `startSession(sessionId, goal, projectId, workspaceDir, agentOverrides)` called
2. If `workspaceDir` not provided, uses `null` → agents run without tools
3. `executeAgentTask()` checks `if (workspaceDir)` → calls `executeAgenticTask()`

**New flow**:
1. When `projectId` is provided → fetch project → may have `repo_url`
2. Before starting tasks:
   - Ensure workspace directory exists (create temp dir if not specified)
   - Call `WorkspaceProvisioner.provisionWorkspace()` with repoUrl
   - Get back `containerId`
3. Store `containerId` in session? Or keep in memory map?
   - Add `sandbox_container_id` column to sessions table
4. Pass `containerId` to `executeAgenticTask()` so it can use DockerCommandService instead of CommandService
5. After session completes/cancels: stop & remove container (keep workspace dir or delete based on config)

**Steps**:

**Step 5.1**: Add `sandbox_container_id VARCHAR(100) NULL` to `sessions` table via migration.

Update `backend/src/db/migrations.ts`:
```sql
ALTER TABLE sessions ADD COLUMN sandbox_container_id VARCHAR(100) NULL;
```

**Step 5.2**: Modify `executeAgenticTask` signature to accept `containerId`:

In `agentic-loop.ts`:
- Replace `new CommandService(workspace)` with `new SandboxCommandService(dockerService)` if containerId provided
- Pass `containerId` to `SandboxCommandService` and `GitService`

**Step 5.3**: Update orchestrator `runTask()` and `startSession()`:

```typescript
// Inside startSession after creating session but before task creation:
let containerId: string | null = null;
if (workspaceDir || projectId) {
  const provisioner = new WorkspaceProvisioner(dockerService);
  const effectiveWorkspaceDir = workspaceDir || `/workspaces/${sessionId}`;
  const project = projectId ? await getProjectById(projectId) : null;
  containerId = await provisioner.provisionWorkspace(
    sessionId,
    effectiveWorkspaceDir,
    project?.repo_url,
    'main' // could be configurable
  );
  // Save container ID to session
  await updateSessionContainerId(sessionId, containerId);
}

// Later, when executing tasks:
const result = await executeAgentTask(
  task.agent_type,
  task.description,
  sessionId,
  task.id,
  workspaceDir, // existing
  signal,
  agentOverrides?.[task.agent_type]?.modelId,
  containerId // NEW
);
```

**Step 5.4**: Update `agent.registry.ts` `executeAgentTask()`:

- Accept `containerId` parameter
- Pass it down to `executeAgenticTask()`
- Inside `executeAgenticTask()`, conditionally create `SandboxCommandService` if containerId provided, else fall back to local `CommandService`

**Step 5.5**: Cleanup on session end:

In orchestrator `finally` block:

```typescript
if (containerId) {
  try {
    await dockerService.destroySandbox(containerId);
  } catch (err) {
    console.error('Failed to destroy sandbox:', err);
  }
}

// Optional: delete workspace directory if configured not to persist
if (workspaceDir && process.env.SANDBOX_PERSIST_WORKSPACE !== 'true') {
  await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
}
```

**Note**: `SANDBOX_PERSIST_WORKSPACE` defaults to `false` — workspace is deleted when session ends. Set to `true` to keep for debugging.

---

### Phase 6: Tool Registry Extension

**Add git tools** to `backend/src/workspace/tools.ts`:

```typescript
{
  name: 'git_diff',
  description: 'Show changes between working tree and HEAD. Use to see what files were modified.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Optional specific file to diff' },
    },
    required: [],
  },
},
{
  name: 'git_status',
  description: 'Show git status of the repository.',
  parameters: { type: 'object', properties: {} },
},
{
  name: 'git_diff_staged',
  description: 'Show staged changes (cached diff).',
  parameters: { type: 'object', properties: {} },
},
{
  name: 'git_add',
  description: 'Stage files for commit.',
  parameters: {
    type: 'object',
    properties: {
      paths: { type: 'array', items: { type: 'string' }, description: 'List of file paths to stage' },
    },
    required: ['paths'],
  },
},
{
  name: 'git_commit',
  description: 'Commit staged changes with a message.',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
    },
    required: ['message'],
  },
},
{
  name: 'git_log',
  description: 'Show recent commit history.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Number of commits to show (default 10)' },
    },
    required: [],
  },
},
{
  name: 'git_branch',
  description: 'Get the current branch name.',
  parameters: { type: 'object', properties: {} },
},
```

**Also extend basic file tools**: If not already present, add `delete_file` and `file_exists` to `AGENT_TOOLS`:

```typescript
{
  name: 'delete_file',
  description: 'Delete a file from the workspace.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path of file to delete' },
    },
    required: ['path'],
  },
},
{
  name: 'file_exists',
  description: 'Check if a file or directory exists.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to check' },
    },
    required: ['path'],
  },
},
```

**Implement in `SandboxCommandService` or separate `GitService`** that uses the same docker exec mechanism.

**Integrate in `tool-executor.ts`**:
- Add cases for `git_diff`, `git_status`, `git_commit`, `git_add`, `git_log`
- These will call methods on `GitService` (which needs to be passed to ToolExecutor constructor)

**Modify ToolExecutor**:

Since SandboxCommandService and GitService now store the containerId in their constructors, ToolExecutor simply delegates to them without needing to know the containerId itself.

```typescript
export class ToolExecutor {
  constructor(
    private fileService: FileService,
    private commandService: SandboxCommandService,
    private gitService?: GitService
  ) {}

  async execute(toolName: string, args: any): Promise<ToolResult> {
    try {
      switch (toolName) {
        // File operations
        case 'read_file':
          const content = await this.fileService.readFile(args.path, args.start_line, args.end_line);
          return { success: true, output: content };

        case 'write_file':
          await this.fileService.writeFile(args.path, args.content);
          return { success: true, output: `File ${args.path} written successfully.` };

        case 'list_directory':
          const files = await this.fileService.listDirectory(args.path, args.recursive);
          return { success: true, output: files.join('\n') };

        case 'delete_file':
          await this.fileService.deleteFile(args.path);
          return { success: true, output: `File ${args.path} deleted.` };

        case 'file_exists':
          const exists = await this.fileService.exists(args.path);
          return { success: true, output: exists ? 'exists' : 'not found' };

        // Command execution
        case 'run_command':
          const cmdResult = await this.commandService.runCommand(args.command, args.timeout);
          return {
            success: cmdResult.exitCode === 0,
            output: `STDOUT:\n${cmdResult.stdout}\n\nSTDERR:\n${cmdResult.stderr}`,
          };

        // Git operations
        case 'git_status':
          const status = await this.gitService!.status();
          return { success: status.exitCode === 0, output: status.stdout };

        case 'git_diff':
          const diff = await this.gitService!.diff('/workspace', args.file_path);
          return { success: diff.exitCode === 0, output: diff.stdout };

        case 'git_diff_staged':
          const staged = await this.gitService!.diffStaged();
          return { success: staged.exitCode === 0, output: staged.stdout };

        case 'git_add':
          await this.gitService!.add(args.paths);
          return { success: true, output: `Staged ${args.paths.length} file(s)` };

        case 'git_commit':
          const commit = await this.gitService!.commit(args.message);
          return {
            success: commit.exitCode === 0,
            output: commit.stdout + (commit.stderr ? '\n' + commit.stderr : ''),
          };

        case 'git_log':
          const log = await this.gitService!.log(args.limit || 10);
          return { success: log.exitCode === 0, output: log.stdout };

        case 'git_branch':
          const branch = await this.gitService!.currentBranch();
          return { success: true, output: branch };

        // Task completion
        case 'task_complete':
          return { success: true, output: args.summary || 'Task completed.' };

        default:
          return { success: false, output: `Unknown tool: ${toolName}` };
      }
    } catch (err: any) {
      return { success: false, output: `Error executing ${toolName}: ${err.message}` };
    }
  }
}
```

**Construction pattern** (inside `executeAgenticTask`):

```typescript
const commandService = new SandboxCommandService(dockerService, containerId);
const gitService = new GitService(dockerService, containerId);
const toolExecutor = new ToolExecutor(fileService, commandService, gitService);
```

---

### Phase 6.5: Browser Testing Infrastructure

**Purpose**: Enable the Tester agent to execute real browser-based tests using headless Chrome/Chromium via Puppeteer or Playwright, both pre-installed in the sandbox image.

**Docker image prerequisites** (already defined in Step 1.3):
- Chromium binary at `/usr/bin/chromium`
- Global npm packages: `puppeteer` and `playwright`
- Environment: `CHROME_PATH`, `PUPPETEER_EXECUTABLE_PATH`, `PLAYWRIGHT_BROWSERS_PATH`

**Agent workflow** (uses existing `write_file` + `run_command` tools):
1. Write a Node.js test script to workspace (e.g., `tests/browser/feature.test.js`) that uses Puppeteer/Playwright
2. Execute it with `run_command`: `node tests/browser/feature.test.js` with extended timeout (120000+ ms)
3. Capture stdout (JSON with results) and any screenshot artifacts
4. Include findings in task summary

**Example Puppeteer test script** (agents should generate similar):
```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new']
  });
  const page = await browser.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.click('#feature-button');
    await page.waitForSelector('.feature-active', { timeout: 5000 });

    // Screenshot on success
    await page.screenshot({ path: 'screenshots/feature-success.png', fullPage: true });

    console.log(JSON.stringify({
      passed: true,
      message: 'Feature works correctly',
      screenshots: ['screenshots/feature-success.png'],
      console: logs
    }));
  } catch (err) {
    await page.screenshot({ path: 'screenshots/feature-error.png', fullPage: true }).catch(() => {});
    console.log(JSON.stringify({
      passed: false,
      error: err.message,
      stack: err.stack,
      screenshots: ['screenshots/feature-error.png'],
      console: logs
    }));
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
```

**Tester agent system prompt update** (`backend/src/agents/tester.agent.ts`):

```typescript
readonly systemPrompt = `You are the Tester agent on a multi-agent development team.

Your responsibilities:
- Write comprehensive test suites (unit, integration, end-to-end)
- Find edge cases and security issues
- Validate that features work as specified

Testing stack available:
- Unit: Jest, Vitest, Mocha (use whatever the project uses)
- E2E: Puppeteer and Playwright with Chromium
  • Chrome binary: /usr/bin/chromium (also via process.env.CHROME_PATH)
  • Launch flags: --no-sandbox --disable-setuid-sandbox (always include these)
  • Example:
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:3000');
    await page.click('#submit');
    await page.screenshot({ path: 'screenshot.png' });
    await browser.close();

Workflow:
1. Understand the feature and what needs testing
2. Choose appropriate test type:
   - Logic/unit → Jest/Vitest test file
   - UI/E2E → Puppeteer/Playwright script
3. Create test file(s) under \`tests/\` or \`__tests__/\` using write_file
4. Install needed test dependencies via run_command: \`npm install --save-dev puppeteer\` (if not already)
5. Run the tests with run_command:
   - \`npm test\` (for unit)
   - \`node tests/browser.test.js\` (for custom Puppeteer scripts)
   - \`npx playwright test\` (if using Playwright)
6. Capture stdout/stderr, parse results
7. If tests fail, analyze errors and either fix code (if coder) or report with details
8. In your final output, include:
   - Test summary (passed/failed)
   - Key assertions checked
   - Errors with stack traces
   - Screenshot file paths (if any)
   - Recommendations for fixes

Important:
- Always use \`--no-sandbox\` and \`--disable-setuid-sandbox\` when launching Chrome in the container
- Set a reasonable timeout (30-60s) for page loads and actions
- Clean up screenshots and temp files after test if not needed
- For Playwright, use \`npx playwright test --reporter=line\` for concise output

Return your output in markdown with a clear TEST RESULTS section at the top.`;
```

**Resource considerations**: Allocate ≥1024MB memory for container when browser testing is expected. Configure via `DOCKER_MEMORY_LIMIT_MB=1024`. Use extended command timeouts (up to 300000 ms).

**No new tool definitions required**; the pattern uses existing `write_file`, `run_command`, and `read_file`. A convenience tool `run_browser_test` could be added later.

**Verification**: During container provisioning, optionally check Chromium is present:

```typescript
async verifyChrome(containerId: string): Promise<boolean> {
  const result = await docker.executeCommand(containerId, ['chromium', '--version']);
  return result.exitCode === 0;
}
```

---

### Phase 7: Streaming Real-time Command Output

**Requirement**: Stream command output to SSE in real-time (like a terminal).

Current `CommandService.runCommand` returns full output after completion. For long-running commands (npm install, build, tests), we want to stream.

**Design**: `SandboxCommandService.runCommandWithStream(containerId, command, onChunk)`:

```typescript
async runCommandWithStream(
  containerId: string,
  command: string[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<{ exitCode: number }> {
  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ stream: true, stdout: true, stderr: true });

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      onChunk(chunk.toString('utf-8'));
    });

    stream.on('error', reject);

    stream.on('close', async () => {
      const info = await exec.inspect();
      resolve({ exitCode: info.ExitCode ?? 0 });
    });

    signal?.addEventListener('abort', () => {
      exec.kill().catch(() => {});
      resolve({ exitCode: -1 });
    });
  });
}
```

Update `agentic-loop.ts` to use streaming when running commands via tools, emitting SSE events as output arrives.

---

### Phase 8: Database Migrations & Queries

**Migrations** (`migrations.ts`):

```sql
-- Add sandbox_container_id to sessions
ALTER TABLE sessions ADD COLUMN sandbox_container_id VARCHAR(100) NULL;

-- Optional: store container status
ALTER TABLE sessions ADD COLUMN sandbox_status VARCHAR(20) NULL; -- running, stopped, error

-- Optional: store last known container logs snapshot?
-- Better to fetch logs from Docker on demand
```

**Queries** (`queries.ts`):

```typescript
export async function updateSessionContainerId(
  id: string,
  containerId: string | null
): Promise<void> {
  const pool = getPool();
  await pool.execute('UPDATE sessions SET sandbox_container_id = ? WHERE id = ?', [containerId, id]);
}

export async function updateSessionSandboxStatus(
  id: string,
  status: string
): Promise<void> {
  const pool = getPool();
  await pool.execute('UPDATE sessions SET sandbox_status = ? WHERE id = ?', [status, id]);
}
```

---

### Phase 9: API Endpoints for Sandbox Management

Add to `backend/src/routes/session.routes.ts` or new `sandbox.routes.ts`:

```typescript
// POST /api/sessions/:id/sandbox/start
router.post('/:id/sandbox/start', async (req, res) => {
  // Start a stopped sandbox (if container exists but is stopped)
});

// POST /api/sessions/:id/sandbox/stop
router.post('/:id/sandbox/stop', async (req, res) => {
  // Stop container but keep workspace
});

// DELETE /api/sessions/:id/sandbox
router.delete('/:id/sandbox', async (req, res) => {
  // Destroy container and optionally workspace
});

// GET /api/sessions/:id/sandbox/logs
router.get('/:id/sandbox/logs', async (req, res) => {
  // Stream container logs
});
```

---

### Phase 10: Error Handling & Robustness

**Docker not available**: Check at boot. If Docker socket missing, log warning and fall back to local command execution (or refuse to start sessions with workspace). Could be configurable via `ALLOW_HOST_EXECUTION=true/false`.

**Container startup failure**: If container fails to start, mark session as failed immediately with clear error.

**Git clone failure**: If repo clone fails (auth, network), surface error via SSE and fail task. Possibly retry with alternate branch.

**Disk space**: Monitor workspace directory sizes. Implement pruning of old workspaces via cron or manual command.

**Zombie containers**: On boot, scan for `label=managed-by=agentforge` containers and reconcile (stop/remove orphaned ones).

---

### Phase 11: Security Considerations

1. **No privileged containers**: Docker `HostConfig.Privileged` is false (default)
2. **Read-only root**: Could make rootfs readonly except `/workspace`
3. **Network access**: `NetworkMode: 'bridge'` (default) to allow outbound connections for npm install, browser tests. No port bindings — inbound traffic blocked.
4. **User namespace**: Container runs as UID 1000, mapped to host UID (non-root). Prevents root inside container = root on host.
5. **Filesystem isolation**: Workspace mounted from host. Agents can only modify that mounted dir. Can't escape container.
6. **Resource limits**: Memory (≥1024MB for browser tests), CPU (≥1.0 core) — configurable via env vars.
7. **Command validation**: Optionally keep allowed-commands whitelist inside container for defense-in-depth. Current `CommandService` whitelist can be reused if desired.
8. **Chrome sandbox**: Puppeteer/Playwright must launch with `--no-sandbox --disable-setuid-sandbox` inside container. This is safe because container is already isolated.

---

### Phase 12: Implementation Order (Practical)

**Week 1**:
1. Dockerfile + build script
2. DockerService with create/start/stop/destroy
3. Basic end-to-end: create container, exec `echo "hello"`

**Week 2**:
4. SandboxCommandService integration
5. Replace CommandService in agentic loop (conditional based on presence of containerId)
6. GitService implementation (clone, status, diff, add, commit)
7. Add git tools to registry

**Week 3**:
8. WorkspaceProvisioner (auto-clone on session start if project has repo_url)
9. Orchestrator integration (create container before tasks, destroy after)
10. Database migrations + session recording of containerId
11. Update Tester agent system prompt for browser testing capabilities

**Week 4**:
12. Streaming output (SSE events for command output in real-time)
13. Error handling & retry logic
14. Integration test: browser testing flow (write Puppeteer script, run, capture screenshot)
15. Testing with real repo (e.g., simple Express app)
16. Documentation & cleanup hooks

---

## File & Directory Structure (New)

```
backend/src/
├── sandbox/
│   ├── Dockerfile                    # Sandbox image definition
│   ├── build.sh                      # Build script
│   ├── docker.service.ts             # Dockerode wrapper
│   └── types.ts                      # Sandbox-related types
├── workspace/
│   ├── sandbox-command.service.ts   # Docker exec-based command runner
│   ├── git.service.ts               # Git operations via Docker
│   └── workspace.provisioner.ts     # Clone repos, init workspace
├── agents/
│   └── agentic-loop.ts              # Modified to use Docker services
├── controllers/
│   └── session.controller.ts        # May need minor updates for workspaceDir param
├── db/
│   └── migrations.ts                # Add sandbox_container_id column
└── routes/
    └── sandbox.routes.ts            # Optional sandbox management endpoints
```

---

## Environment Variables

Add to `.env.example`:

```env
# Docker Sandbox
DOCKER_SANDBOX_IMAGE=agentforge-sandbox:latest
DOCKER_NETWORK_MODE=bridge              # Allow outbound network (required for npm install, browser tests)
DOCKER_MEMORY_LIMIT_MB=1024             # 1GB minimum for Chrome/Puppeteer
DOCKER_CPU_LIMIT=1.0                    # 1 core
SANDBOX_PERSIST_WORKSPACE=false         # Keep workspace after session ends?
SANDBOX_MAX_IDLE_MINUTES=60             # Auto-cleanup idle workspaces

# Workspace base directory
WORKSPACE_ROOT_DIR=./workspaces          # Host path for storing workspace volumes

# Optional: increase if running many browser tests
# SANDBOX_BROWSER_TIMEOUT_MS=300000      # 5 minutes for browser test scripts
```

---

## Testing Plan

**Unit tests**:
- DockerService: mock Dockerode, test container lifecycle
- SandboxCommandService: test command construction, timeout handling
- GitService: test git command wrappers

**Integration tests**:
- Provision a session with a simple GitHub repo (e.g., hello-world)
- Run `ls`, `cat package.json` via tools
- Modify a file, commit, view diff
- Run `npm install` and `npm test`
- Ensure isolation: changes only in workspace mount

**Manual QA**:
1. Create project with GitHub URL
2. Start session with that project
3. Watch agent coder:
   - reads files ✓
   - writes new file ✓
   - runs `npm install` ✓
   - runs tests ✓
   - commits changes (optional, if configured) ✓
4. Cancel session → container destroyed
5. Restart session with same project → fresh container but same workspace (if persisted)

---

## Open Questions & Decisions

### Q1: Should git push be allowed?
**Decision**: No, by default. Agents should make local commits but not push to remote unless explicitly configured by user (dangerous). Could add a project-level setting: `allow_push: boolean`. Default false.

### Q2: Should we pre-install dependencies or run `npm install` each time?
**Decision**: Fresh container each session. Run `npm install` as needed by agents (they'll detect missing node_modules). Could cache node_modules in workspace volume (persisted across container recreates) for speed.

### Q3: Network access inside container?
**Decision**: `bridge` network (allows outbound). Required for `npm install`, browser tests, and any external API calls. No inbound port mappings, so container cannot receive incoming connections. Default is `bridge`.

### Q4: How to get command output streaming?
**Decision**: Modify `SandboxCommandService` to accept an `onChunk` callback and propagate to SSE. In `agentic-loop`, when calling `toolExecutor.execute()`, if it's a long-running command, emit `agent_tool_result` events incrementally.

Implementation: Change ToolExecutor.execute to return a stream or accept an event emitter. Simpler: Keep synchronous result but have `SandboxCommandService.runCommand` internally buffer and return full output; streaming can be added later as enhancement.

**Phase 11** can add streaming.

### Q5: What about large files / binary files?
FileService currently reads entire file into memory as UTF-8. For binary files, should return base64 or reject. Limit max file size (already have 50KB for repo context, but agents can read larger?). Add MAX_FILE_READ_SIZE = 1MB guard.

---

## Implementation Readiness Checklist

- [x] Docker installed on host (dev & prod)
- [x] Node.js types for Dockerode (comes with lib)
- [ ] Create Dockerfile (with Chromium, Puppeteer, Playwright)
- [ ] Build sandbox image locally
- [ ] Install dockerode (`npm install dockerode`)
- [ ] Create DockerService class
- [ ] Create SandboxCommandService
- [ ] Create GitService
- [ ] Update ToolExecutor to support git tools and new command service
- [ ] Add git tools to tools.ts
- [ ] Create WorkspaceProvisioner
- [ ] Add DB migrations (sandbox_container_id, sandbox_status)
- [ ] Update queries.ts with new update functions
- [ ] Update agent.registry.executeAgentTask to accept containerId
- [ ] Update agentic-loop to create Docker-aware services
- [ ] Update orchestrator startSession to provision container
- [ ] Add cleanup logic (destroy container on session end)
- [ ] Add error handling for Docker failures
- [ ] Update tester agent system prompt for browser testing (Puppeteer/Playwright usage)
- [ ] Verify Chromium availability in container via health check
- [ ] Test end-to-end with real repo including browser test execution
- [ ] Add SSE streaming for command output (optional phase 1)

---

## Success Criteria

- Session with GitHub project clones repo into sandbox
- Agents can read/write files via FileService (works on mounted volume)
- Agents can run commands (`npm install`, `npm test`) via SandboxCommandService
- Tester agent can execute browser-based tests using headless Chrome (Puppeteer/Playwright) and capture screenshots/artifacts
- All execution happens inside container, not host
- Container destroyed on session completion
- Workspace persists on host (configurable)
- Git operations available as tools: diff, status, add, commit, log
- Real-time SSE output (basic, full streaming later)
- No security vulnerabilities: no host file access, non-root user, resource limits

---

This plan integrates Docker sandboxing into the existing AgentForge architecture with minimal disruption to the agent execution flow while providing strong isolation.
