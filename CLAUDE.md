# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install all dependencies (root + backend + frontend)
npm run install:all

# Run both backend and frontend simultaneously (recommended)
npm run dev

# Backend only (port 3001, hot-reload via tsx)
cd backend && npm run dev

# Frontend only (port 5173, Vite)
cd frontend && npm run dev

# Build backend (TypeScript → dist/)
cd backend && npm run build

# Start backend production build
cd backend && npm start
```

There is no test suite yet. Type-check with `cd backend && npx tsc --noEmit` and `cd frontend && npx tsc --noEmit`.

## Environment Setup

Copy `backend/.env.example` to `backend/.env` and fill in:
- `OPENROUTER_API_KEY` — required; all LLM calls route through OpenRouter
- MySQL credentials — create the DB first: `CREATE DATABASE agentforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

DB migrations run automatically on server startup (`backend/src/db/migrations.ts` uses `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER TABLE ADD COLUMN` calls, so re-running is safe).

## Architecture

AgentForge is a full-stack multi-agent AI orchestration system. Users provide a natural-language goal; a "Manager" agent decomposes it into tasks assigned to specialist agents that run in parallel.

### Backend (`backend/src/`)

**Entry point:** `server.ts` → `app.ts` → registers all routes under `/api`.

**Orchestration flow:**
1. `POST /api/sessions` → `session.controller.ts` → calls `orchestrator.startSession()`
2. `orchestrator.ts` creates a session record, calls `ManagerAgent.decompose()` to get a task plan, creates `Task` DB rows, emits SSE events, then runs all tasks in parallel via `executeAgentTask()`
3. After all tasks complete, `ManagerAgent.synthesize()` merges outputs into a final report

**Agent system (`agents/`):**
- `BaseAgent` — abstract class; `execute()` calls OpenRouter with a system prompt + user task
- Built-in agents: `researcher`, `coder`, `tester`, `rnd`, `manager` — each extends `BaseAgent`
- Custom agents are stored in MySQL (`custom_agents` table) and resolved alongside built-ins at runtime via `agent.registry.ts`
- `agent.registry.ts` is the single dispatch point: `executeAgentTask()` resolves the agent, tries the primary model, then dynamically fetches and shuffles all available free OpenRouter models as fallbacks on 429/rate-limit errors

**Agentic loop (`agents/agentic-loop.ts`):**
When a session has a `workspaceDir`, tasks use a tool-calling loop (max 20 iterations) instead of a single LLM call. The agent can call `read_file`, `write_file`, `list_directory`, `run_command`, and `task_complete` tools defined in `workspace/tools.ts`. Tool calls are parsed from the LLM's JSON response, executed by `ToolExecutor`, and each step is saved to `agent_steps` in the DB.

**Heartbeat system (`orchestrator/heartbeat.service.ts`):**
A `node-cron` job fires every N minutes per session. On each tick:
1. All agents contribute chat messages about recent progress
2. The manager agent evaluates chat messages and may auto-spawn new tasks (capped at `MAX_AUTO_SPAWNED_TASKS`)

An *immediate* heartbeat also fires after each task completes — all other agents comment on the finished task (stored as `task_comments`).

**Model routing (`services/model-router.service.ts`):**
Routes calls to the correct provider based on model string prefix:
- `...:free` → OpenRouter (free tier)
- `openai/...` → Direct OpenAI API (requires BYOK key stored encrypted in `model_configs`)
- `anthropic/...` → Direct Anthropic API
- `google/...` → Direct Google API
- `groq/...` → Direct Groq API
- Anything else → OpenRouter (paid)

API keys for BYOK providers are encrypted with `services/crypto.service.ts` before being stored.

**SSE (`controllers/sse.controller.ts`):**
`GET /api/sse/:sessionId` opens a persistent SSE stream. All orchestrator events (`task_created`, `task_claimed`, `task_complete`, `task_failed`, `task_comment`, `chat_message`, `session_complete`, `agent_thinking`, `agent_tool_use`, etc.) are typed in `types/index.ts` as `SSEEvent`.

**Database (`db/`):**
MySQL via `mysql2/promise` connection pool. `queries.ts` contains all raw SQL — no ORM. All timestamps are Unix milliseconds (BIGINT). Schema tables: `projects`, `sessions`, `tasks`, `task_comments`, `chat_messages`, `agent_steps`, `file_changes`, `custom_agents`, `model_configs`.

### Frontend (`frontend/src/`)

React 18 + Vite + TypeScript + Tailwind CSS. State management via Zustand stores.

**Layout:** Single-page app. `App.tsx` composes:
- `AppHeader` — goal input, session controls, nav buttons
- `AgentSidebar` — live agent status cards
- `MissionQueue` — Kanban-style task board (todo / in-progress / done columns)
- `LiveFeed` — real-time event stream
- Modals: `AgentManager`, `ModelSelectorModal`

**State stores (`store/`):**
- `sessionStore` — current session, task list (upserted via SSE), comments, chat messages
- `feedStore` — ordered live-feed events for the LiveFeed panel
- `agentStore` — loaded agent definitions from `/api/agents`
- `modelStore` — available free/BYOK models from `/api/models`
- `projectStore` — project CRUD
- `themeStore` — dark/light toggle (persisted)

**SSE integration (`hooks/useSSE.ts`):**
Opens `EventSource` to `GET /api/sse/:sessionId`. All SSE messages dispatch directly into Zustand stores. Reconnects automatically on drop; checks session status before reconnecting to avoid reconnecting to completed sessions.

**API client (`api/client.ts`):**
Axios instance pointing at `VITE_API_BASE_URL` (defaults to `http://localhost:3001`). All API calls go through this module.

## Key Conventions

- All IDs are UUIDs generated with `uuid` v4.
- Session/task status values are defined in `backend/src/types/index.ts` — don't use raw strings.
- Frontend types mirror backend types; keep `frontend/src/types/index.ts` in sync when changing the data model.
- New agents must be registered in `BUILT_IN_AGENTS` in `agent.registry.ts` or created via the custom agents API.
- Adding a new SSE event type requires updating the `SSEEvent` union in `backend/src/types/index.ts` and the `handleMessage` switch in `frontend/src/hooks/useSSE.ts`.
