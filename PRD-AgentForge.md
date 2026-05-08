# PRD: AgentForge — AI Multi-Agent Coding Team with Mission Control Dashboard

**Document Version:** 2.0  
**Author:** Navdeep (Product Owner)  
**Target Builder:** Claude Code  
**Status:** Ready for Implementation  
**Inspired by:** Bhanu Teja P's Mission Control (SiteGPT founder) — replicated without OpenClaw, using OpenRouter API directly

---

## 1. Executive Summary

AgentForge is a **self-hosted, browser-based multi-agent AI system** purpose-built for solo developers. It replicates the exact behavior of Bhanu Teja P's viral "Mission Control" agent squad — but instead of OpenClaw, it uses the **OpenRouter API directly**, giving you full control, free tiers, and the ability to plug in any paid model with your own API key.

You get a team of specialized AI coding agents (Manager/Jarvis, Researcher, Coder, Tester, R&D Analyst) that:
- **Create tasks on their own** — Jarvis decomposes your goal into tasks automatically
- **Claim tasks on their own** — agents pick up and own tasks without you assigning them
- **Talk with each other** — a real-time Agent Chat Feed where agents post insights on each other's tasks
- **Review and refute each other** — agents attach their perspective to any active task card
- **Heartbeat system** — every agent scans the board every 15 minutes and comments on anything relevant
- **Kanban board** — every task is a card moving through Todo → In Progress → Done
- **Mission Control dashboard** — one view showing all agents, all tasks, all agent-to-agent conversations

**Model flexibility:**
- Free tier: OpenRouter free models (zero cost)
- Bring Your Own Key: OpenAI, Anthropic, Google, Mistral, Groq, or any OpenRouter-supported model using your own API key
- Per-agent model selection — assign different models to different agents

---

## 2. Problem Statement

Bhanu Teja P built a system of 10 autonomous AI agents that run his SiteGPT business 24/7 — agents that create work, claim tasks, collaborate, refute each other, and ship output without his constant input. The entire community tried to copy it. The blocker: it required OpenClaw infrastructure, heartbeat servers, and complex setup.

AgentForge solves this: the same multi-agent collaboration loop, same Kanban board, same agent chat feed — built as a clean self-hosted React + Node.js app, no OpenClaw needed, powered by any model through OpenRouter.

---

## 3. Goals & Non-Goals

### Goals
- Replicate the exact Mission Control behavior: agents create, claim, review, refute, and complete tasks
- Real-time Kanban board with agent ownership and multi-agent commentary on task cards
- Agent Chat Feed — a shared "watercooler" where agents post insights that can spawn new tasks
- Heartbeat system — agents periodically scan all open tasks and add relevant commentary
- Manager (Jarvis) agent that decomposes goals, assigns tasks, and synthesizes final reports
- Agents can add new tasks to the board based on insights from the chat feed (autonomous task creation)
- Full model flexibility: free OpenRouter models + BYOK for OpenAI / Anthropic / Gemini / Groq
- Per-agent model assignment
- Custom agent creation via UI
- Persistent history (MySQL)
- Token usage and cost tracking per session

### Non-Goals (v1)
- No file system access or code execution by agents (text/markdown output only)
- No voice interface
- No multi-user / team collaboration
- No streaming responses (full response per agent call, streaming in v2)
- No mobile app

---

## 4. User Stories

| ID | As a user, I want to... | So that... |
|----|------------------------|------------|
| US-01 | Type a high-level goal and have Jarvis plan and assign all tasks | I never manually create or assign tasks |
| US-02 | Watch the Kanban board update live as agents pick up and complete tasks | I have full visibility without asking |
| US-03 | See each task card show comments from multiple agents | I see genuine multi-agent collaboration, not just one bot's output |
| US-04 | Watch the Agent Chat Feed where agents post insights in real time | I can see how agents talk to each other like a team chatroom |
| US-05 | See new tasks appear automatically when an agent finds something worth acting on | The system generates its own work, reducing my input |
| US-06 | Click any task card to see the full output + all agent comments on that task | I get the full picture of what was done |
| US-07 | See the Manager's final synthesis report after all tasks complete | I get a unified actionable summary |
| US-08 | Add custom agents with their own name, system prompt, and model | I extend the team without touching code |
| US-09 | Select from a list of free OpenRouter models | I can run the whole system for $0 |
| US-10 | Enter my own OpenAI / Anthropic / Gemini / Groq API key for premium agents | I can use GPT-4o or Claude for specific agents when I want quality |
| US-11 | See token usage and estimated cost per session | I can track what I'm spending (even if $0) |
| US-12 | Cancel a running session and have all in-progress work stop cleanly | I don't waste tokens on a runaway session |
| US-13 | Browse history of all past sessions with their tasks and outputs | I can reference past agent work |
| US-14 | Configure the heartbeat interval (how often agents scan the board) | I control how "autonomous" vs resource-intensive the system is |

---

## 5. System Architecture

```
+------------------------------------------------------------------+
|                      FRONTEND (React + Vite)                     |
|  +--------------+  +-----------------+  +---------------------+  |
|  |  Goal Input  |  |  Kanban Board   |  |  Agent Chat Feed    |  |
|  +--------------+  |  (live SSE)     |  |  (live SSE)         |  |
|                    +-----------------+  +---------------------+  |
|  +------------------------------------------------------------+   |
|  |    Agent Status Panel | Final Report | Session History     |   |
|  +------------------------------------------------------------+   |
+---------------------------+--------------------------------------+
                            | REST + SSE
+---------------------------v--------------------------------------+
|                   BACKEND (Node.js + Express)                    |
|  +------------------------------------------------------------+  |
|  |                   Orchestration Engine                     |  |
|  |  +--------------+    +--------------------------------+    |  |
|  |  | Jarvis       |    | Task Queue + Claim System      |    |  |
|  |  | (Manager)    |--->| (agents claim & own tasks)     |    |  |
|  |  +--------------+    +--------------------------------+    |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+  |  |
|  |  |  Sub-Agent Pool (parallel execution)                 |  |  |
|  |  |  Researcher | Coder | Tester | R&D | [custom agents] |  |  |
|  |  +------------------------------------------------------+  |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+  |  |
|  |  |  Heartbeat System (periodic board scan per agent)    |  |  |
|  |  +------------------------------------------------------+  |  |
|  +------------------------------------------------------------+  |
|  +------------------------------------------------------------+  |
|  |                  MySQL 8+ (mysql2 connection pool)         |  |
|  +------------------------------------------------------------+  |
+---------------------------+--------------------------------------+
                            | HTTPS
+---------------------------v--------------------------------------+
|                     Model Routing Layer                          |
|                                                                  |
|  OpenRouter (free models)      |  BYOK (your own API keys)      |
|  -------------------------     |  --------------------------    |
|  deepseek/deepseek-r1:free     |  OpenAI (GPT-4o, o1)          |
|  llama-3.3-70b-instruct:free   |  Anthropic (claude-sonnet-4-6) |
|  gemini-2.0-flash-exp:free     |  Google (gemini-1.5-pro)       |
|  mistral-7b-instruct:free      |  Groq (llama3-70b)            |
|                                |  Any OpenRouter paid model    |
+------------------------------------------------------------------+
```

### Key Behavioral Loop (The Mission Control Loop)

```
User sends goal via UI
        |
        v
Jarvis (Manager) decomposes goal into tasks + assigns agents
        |
        v
Tasks appear on Kanban board as "Todo" cards
        |
        v
Each assigned agent "claims" its task --> card moves to "In Progress"
        |
        v
Agents work in parallel, each calling OpenRouter/BYOK
        |
        v
Agent completes task --> output saved --> card moves to "Done"
        |
        v
ALL OTHER AGENTS are notified of the new output (via immediate heartbeat)
        |
        v
Each agent reads the completed task and posts a comment/insight if relevant
        |
        v
If an agent's comment warrants a new task --> Jarvis creates it automatically
        |
        v
Agent Chat Feed shows all inter-agent conversations in real time
        |
        v
When all tasks settle --> Jarvis writes the final synthesis report
```

---

## 6. Tech Stack (Exact Versions)

### Frontend
```
Framework:     React 19 + TypeScript 6
Build Tool:    Vite 8
Styling:       Tailwind CSS 4.2 (CSS-first theme via `@theme`, `@custom-variant`, Vite plugin)
State:         Redux Toolkit 2 + React Redux 9
HTTP Client:   Axios 1.16
Real-time:     Native EventSource API (SSE)
Icons:         Lucide React 1.x
Drag & Drop:   @dnd-kit/core 6.3 + @dnd-kit/sortable 10
Markdown:      react-markdown 10 + remark-gfm 4 + react-syntax-highlighter 16
```

### Backend
```
Runtime:       Node.js 20+
Framework:     Express 5.2
Language:      TypeScript 6
Database:      MySQL 8+ via mysql2 (async connection pool, no ORM)
Validation:    Zod 4
Env Config:    dotenv + Zod
Real-time:     Manual SSE (res.write pattern)
Scheduling:    node-cron 4
HTTP Client:   Native fetch (Node 20+)
IDs:           uuid v14
```

---

## 7. Folder Structure

### Backend
```
backend/
├── src/
│   ├── agents/
│   │   ├── base.agent.ts          # Abstract base — all agents extend this
│   │   ├── manager.agent.ts       # Jarvis: goal decomposition + synthesis
│   │   ├── researcher.agent.ts    # Feature/library research
│   │   ├── coder.agent.ts         # TypeScript/Node/React code generation
│   │   ├── tester.agent.ts        # Jest/Vitest test writing
│   │   ├── rnd.agent.ts           # Competitor + R&D analysis
│   │   ├── agent.registry.ts      # Loads built-in + custom agents at runtime
│   │   └── heartbeat.agent.ts     # Scans open tasks, posts agent commentary
│   ├── config/
│   │   └── env.ts                 # Zod-validated env vars (crash on boot if missing)
│   ├── controllers/
│   │   ├── session.controller.ts  # POST /sessions, GET /sessions, DELETE cancel
│   │   ├── task.controller.ts     # GET /tasks/:id, POST /tasks/:id/comments
│   │   ├── agent.controller.ts    # CRUD for custom agents
│   │   ├── model.controller.ts    # GET /models (available free + paid models)
│   │   └── sse.controller.ts      # GET /sse/:sessionId
│   ├── db/
│   │   ├── database.ts            # MySQL connection pool singleton (mysql2)
│   │   ├── migrations.ts          # Full schema creation on startup (CREATE TABLE IF NOT EXISTS)
│   │   └── queries.ts             # All typed SQL query functions
│   ├── middleware/
│   │   ├── error.middleware.ts    # Global Express error handler
│   │   └── logger.middleware.ts   # Request logging (morgan-style)
│   ├── orchestrator/
│   │   ├── orchestrator.ts        # Core engine: dispatch, claim, heartbeat
│   │   └── heartbeat.service.ts   # node-cron job: triggers agent board scans
│   ├── routes/
│   │   ├── index.ts               # Aggregates all routes
│   │   ├── session.routes.ts
│   │   ├── task.routes.ts
│   │   ├── agent.routes.ts
│   │   ├── model.routes.ts
│   │   └── sse.routes.ts
│   ├── services/
│   │   ├── openrouter.service.ts  # OpenRouter free model API wrapper
│   │   └── model-router.service.ts # Routes to OpenRouter OR BYOK endpoints
│   ├── sse/
│   │   └── sse-manager.ts         # Map<sessionId, Response> — manages SSE connections
│   ├── types/
│   │   └── index.ts               # All shared interfaces
│   ├── app.ts                     # Express app config (no listen)
│   └── server.ts                  # HTTP server entry point (listen here)
├── .env.example
├── package.json
└── tsconfig.json
```

### Frontend
```
frontend/
├── src/
│   ├── components/
│   │   ├── KanbanBoard/
│   │   │   ├── KanbanBoard.tsx       # 3-column board layout
│   │   │   ├── KanbanColumn.tsx      # Todo / In Progress / Done column
│   │   │   ├── TaskCard.tsx          # Task card with agent badge + comment count
│   │   │   └── TaskDetailModal.tsx   # Full task output + threaded agent comments
│   │   ├── AgentChatFeed/
│   │   │   ├── AgentChatFeed.tsx     # Scrolling real-time chat between agents
│   │   │   └── ChatMessage.tsx       # Single agent message bubble
│   │   ├── AgentPanel/
│   │   │   ├── AgentPanel.tsx        # Row of agent cards with live status
│   │   │   └── AgentBadge.tsx        # Colored icon + name + current task
│   │   ├── GoalInput/
│   │   │   └── GoalInput.tsx         # Goal textarea + Run button
│   │   ├── FinalReport/
│   │   │   └── FinalReport.tsx       # Markdown-rendered Manager synthesis
│   │   ├── ModelSelector/
│   │   │   ├── ModelSelector.tsx     # Dropdown for free models + BYOK input
│   │   │   └── ApiKeyManager.tsx     # Manage BYOK API keys per provider
│   │   ├── AgentManager/
│   │   │   └── AgentManager.tsx      # Add/edit/delete custom agents + assign models
│   │   ├── HeartbeatConfig/
│   │   │   └── HeartbeatConfig.tsx   # Set heartbeat interval per agent
│   │   ├── SessionHistory/
│   │   │   └── SessionHistory.tsx    # Past sessions list + reload
│   │   ├── TokenTracker/
│   │   │   └── TokenTracker.tsx      # Live token count + estimated cost
│   │   └── Layout/
│   │       └── AppLayout.tsx         # Top nav + page layout
│   ├── hooks/
│   │   ├── useSSE.ts                 # SSE connection + event dispatcher
│   │   └── useSession.ts             # Session CRUD + state
│   ├── store/
│   │   ├── store.ts                  # Redux store configuration
│   │   ├── hooks.ts                  # Typed Redux hooks
│   │   ├── sessionStore.ts           # Redux slice: session, tasks, comments, chat messages
│   │   ├── agentStore.ts             # Redux slice: agent config + custom agents
│   │   ├── projectStore.ts           # Redux slice: projects + current project
│   │   ├── modelStore.ts             # Redux slice: model list + per-agent overrides
│   │   ├── themeStore.ts             # Redux slice: theme preference
│   │   ├── feedStore.ts              # Redux slice: live feed events
│   │   └── persistence.ts            # localStorage helpers for persisted UI state
│   ├── api/
│   │   └── client.ts                 # Axios instance + typed API calls
│   ├── types/
│   │   └── index.ts                  # Mirrors backend types
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
└── package.json
```

---

## 8. Database Schema (MySQL 8+)

```sql
-- Sessions: one session = one goal run
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY,
  goal TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | running | completed | cancelled
  final_report LONGTEXT,
  total_tokens_used INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) DEFAULT 0.0,
  heartbeat_interval_minutes INT DEFAULT 15,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tasks: individual units of work on the board
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,         -- 'researcher' | 'coder' | 'tester' | 'rnd' | custom slug
  agent_name VARCHAR(100) NOT NULL,         -- Display name e.g. "Researcher"
  title VARCHAR(255) NOT NULL,              -- Short task title (from Jarvis)
  description TEXT NOT NULL,               -- Full task instructions
  status VARCHAR(20) NOT NULL DEFAULT 'todo',  -- todo | in_progress | done | failed | cancelled
  output LONGTEXT,                          -- Agent's primary response (markdown)
  tokens_used INT DEFAULT 0,
  model_used VARCHAR(200),                  -- Which model handled this task
  spawned_by_agent VARCHAR(100),            -- If auto-created by heartbeat, which agent spawned it
  started_at BIGINT,
  completed_at BIGINT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Task comments: agent-to-agent commentary on task cards (the "review/refute" system)
CREATE TABLE IF NOT EXISTS task_comments (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  content LONGTEXT NOT NULL,               -- Agent's comment/insight/refutation (markdown)
  comment_type VARCHAR(20) NOT NULL DEFAULT 'insight',  -- insight | review | refute | praise | question
  tokens_used INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agent chat messages: the shared watercooler feed
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  content LONGTEXT NOT NULL,               -- What the agent said
  spawns_task TINYINT(1) DEFAULT 0,        -- 1 if this message triggered a new task
  spawned_task_id VARCHAR(36),             -- FK to tasks.id if spawns_task = 1
  created_at BIGINT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Custom agents: user-created agent definitions
CREATE TABLE IF NOT EXISTS custom_agents (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(100) NOT NULL,              -- slug e.g. 'security_auditor'
  description TEXT NOT NULL,
  system_prompt LONGTEXT NOT NULL,
  model VARCHAR(200) NOT NULL,             -- OpenRouter model string OR BYOK provider:model
  color VARCHAR(20) NOT NULL,              -- Hex color
  icon VARCHAR(50) NOT NULL,               -- Lucide icon name
  heartbeat_enabled TINYINT(1) DEFAULT 1,
  is_active TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uk_agent_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Model configurations: stored BYOK keys (encrypted at rest with AES-256)
CREATE TABLE IF NOT EXISTS model_configs (
  id VARCHAR(36) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,           -- 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter'
  api_key_encrypted TEXT,                  -- AES-256-GCM encrypted key (iv:authTag:ciphertext)
  is_active TINYINT(1) DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE KEY uk_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 9. Agent Definitions

### 9.1 The Three Agent Operating Modes

Every agent in AgentForge has three modes of operation — this is what makes it Mission Control, not just a simple agent runner.

**Mode 1: Task Execution** — An agent is assigned a task and produces primary output.

**Mode 2: Heartbeat Commentary** — On every heartbeat tick (and immediately after any task completes), an agent reads ALL recently completed tasks and posts comments where it has something valuable to add. This is the "review/refute/praise" behavior from Bhanu's system.

**Mode 3: Chat Contribution** — An agent proactively posts to the shared chat feed when it notices something worth sharing. Other agents read the feed and can respond. Jarvis reads the feed and spawns new tasks from it.

---

### 9.2 Built-in Agent Definitions

#### Jarvis (Manager Agent)
```
Role:         Squad Lead and Synthesizer
Color:        #F97316 (orange) | Icon: Brain
Model:        meta-llama/llama-3.3-70b-instruct:free (default)

Mode 1 - Goal Decomposition:
  Input:  User goal + list of all active agent names/descriptions
  Output: Strict JSON array of tasks with agent_type assignments
  Prompt: See Section 14

Mode 2 - Heartbeat:
  Every heartbeat, Jarvis reads the chat feed.
  If any agent message warrants a new task, Jarvis creates it and assigns it.
  This is the autonomous task creation loop.

Mode 3 - Synthesis:
  After all tasks complete, Jarvis writes the final report.
```

#### Researcher
```
Role:         Feature Research Specialist
Color:        #3B82F6 (blue) | Icon: Search
Model:        google/gemini-2.0-flash-exp:free (default)

Mode 1 - Task Execution:
  Researches features, libraries, APIs, patterns for the given task.
  Returns structured markdown: overview, recommendation, code examples, pros/cons.

Mode 2 - Heartbeat Commentary:
  Reads completed Coder and Tester tasks.
  Posts if it knows of a better library, newer approach, or missing best practice.
  Comment type: 'insight' or 'refute'

Mode 3 - Chat Contribution:
  Posts interesting findings proactively, e.g.:
  "I noticed we're using express-session — jsonwebtoken + Redis would be
  more scalable at production load."
```

#### Coder
```
Role:         Code Generation Specialist
Color:        #10B981 (green) | Icon: Code2
Model:        deepseek/deepseek-r1:free (default — best free coding model)

Mode 1 - Task Execution:
  Writes production-quality TypeScript/Node.js/React code.
  Includes inline comments, error handling, async/await, clean architecture.
  Returns labeled markdown code blocks.

Mode 2 - Heartbeat Commentary:
  Reads Researcher and Tester outputs.
  Posts code improvements, refactors, or alternative implementations.
  Comment type: 'refute' if it disagrees, 'praise' if approach is solid.

Mode 3 - Chat Contribution:
  Posts code snippets if it sees something worth sharing with the team.
```

#### Tester
```
Role:         QA and Testing Specialist
Color:        #F59E0B (amber) | Icon: TestTube
Model:        meta-llama/llama-3.3-70b-instruct:free (default)

Mode 1 - Task Execution:
  Writes Jest/Vitest unit tests, integration test scenarios, edge case lists.
  Returns complete test files in markdown code blocks.

Mode 2 - Heartbeat Commentary:
  Reads Coder outputs.
  Posts missing test cases, security issues, or edge cases the Coder missed.
  Comment type: 'review' or 'refute'

Mode 3 - Chat Contribution:
  Posts testing insights, e.g.:
  "The auth middleware has no test for expired tokens — this will fail in production."
```

#### R&D Analyst
```
Role:         Competitive Intelligence Specialist
Color:        #8B5CF6 (purple) | Icon: BarChart2
Model:        google/gemini-2.0-flash-exp:free (default)

Mode 1 - Task Execution:
  Analyzes what competing tools/products do well in the area being built.
  Returns: top 3-5 competitors, what they do well, actionable improvements.
  Prioritizes suggestions: High / Medium / Low impact.

Mode 2 - Heartbeat Commentary:
  Reads all completed task outputs.
  Posts market context: "Linear does this differently — here's why it matters."
  Comment type: 'insight'

Mode 3 - Chat Contribution:
  Posts competitive observations proactively.
```

---

## 10. Model Configuration System

This is a major addition from v1. The system supports three tiers of models and routes calls accordingly.

### Tier 1: Free Models (OpenRouter, only need OPENROUTER_API_KEY)

| Model String | Provider | Best For |
|---|---|---|
| `deepseek/deepseek-r1:free` | DeepSeek | Code generation |
| `meta-llama/llama-3.3-70b-instruct:free` | Meta | Planning, reasoning |
| `google/gemini-2.0-flash-exp:free` | Google | Research, fast responses |
| `mistralai/mistral-7b-instruct:free` | Mistral | Lightweight fallback |
| `qwen/qwen-2.5-72b-instruct:free` | Alibaba | Multilingual, general use |

### Tier 2: Paid Models via BYOK (user provides their own API key)

| Provider | Model Examples | Key Storage |
|---|---|---|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1-preview` | AES-256 encrypted in MySQL |
| Anthropic | `claude-sonnet-4-6`, `claude-opus-4-6` | AES-256 encrypted in MySQL |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash` | AES-256 encrypted in MySQL |
| Groq | `llama3-70b-8192`, `mixtral-8x7b` | AES-256 encrypted in MySQL |

### Tier 3: Any OpenRouter Paid Model
All OpenRouter models accessible via the same key — change the model string in agent config.

### Model Router Service (`model-router.service.ts`)
Routes the call based on the model string:
- Contains `:free` → OpenRouter free endpoint
- Starts with `openai/` → BYOK OpenAI key → `api.openai.com`
- Starts with `anthropic/` → BYOK Anthropic key → `api.anthropic.com`
- Starts with `google/` (no `:free`) → BYOK Google key → `generativelanguage.googleapis.com`
- Starts with `groq/` → BYOK Groq key → `api.groq.com`
- Otherwise → OpenRouter API (uses OpenRouter key, may consume credits)

### UI: Model Selector Component
Appears in two places:
1. **Settings → Models** — set default model for each built-in agent
2. **Agent Manager** — override model for a specific custom agent

Free models show normally. Paid models show a `$ BYOK` badge. If a BYOK model is selected but the key is not configured, show a warning linking to the API Key Manager.

### UI: API Key Manager
A settings panel where users add their own keys:
- One input row per provider (OpenAI, Anthropic, Google, Groq)
- Keys sent to backend once during save, stored AES-256 encrypted in MySQL
- Frontend never stores raw keys
- Keys shown masked after saving: `sk-proj-...****`
- "Test Key" button verifies the key works before saving
- "Remove" button deletes the encrypted key from MySQL

---

## 11. API Specification

### Sessions

#### POST /api/sessions
Start a new agent session.

**Request:**
```json
{
  "goal": "Add JWT authentication to my Express API"
}
```

**Response 201:**
```json
{
  "sessionId": "uuid",
  "status": "running"
}
```

**Internal flow:**
1. Create session record (status: pending)
2. Call Jarvis with goal + active agent list
3. Parse JSON task plan
4. Create task records (status: todo)
5. Emit SSE: `task_created` for each task
6. Dispatch tasks to agents (non-blocking, all parallel)
7. Return immediately with sessionId

#### GET /api/sessions
List all sessions (paginated, newest first).

#### GET /api/sessions/:id
Get session with all tasks, comments, and chat messages.

#### DELETE /api/sessions/:id/cancel
Cancel and abort all in-progress agent calls.

---

### Tasks

#### GET /api/tasks/:id
Get a single task with all its comments.

#### POST /api/tasks/:id/comments
(Internal — agents post commentary via heartbeat)

```json
{
  "agent_type": "tester",
  "agent_name": "Tester",
  "content": "The auth middleware is missing a test for malformed JWT tokens...",
  "comment_type": "review"
}
```

---

### Chat Feed

#### GET /api/sessions/:sessionId/chat
Get all chat messages for a session.

#### POST /api/sessions/:sessionId/chat
(Internal — agents post to the chat feed)

```json
{
  "agent_type": "researcher",
  "agent_name": "Researcher",
  "content": "I found that jsonwebtoken v9 has a critical fix for algorithm confusion attacks..."
}
```

---

### Models

#### GET /api/models
Returns all available free models + BYOK-configured paid models.

**Response:**
```json
{
  "free": [
    {
      "id": "deepseek/deepseek-r1:free",
      "name": "DeepSeek R1",
      "provider": "DeepSeek",
      "best_for": "Code generation",
      "context_window": 65536
    }
  ],
  "byok": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "provider": "OpenAI",
      "configured": true
    },
    {
      "id": "anthropic/claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6",
      "provider": "Anthropic",
      "configured": false
    }
  ]
}
```

#### POST /api/models/keys
Save a BYOK API key (encrypted before storage).

```json
{
  "provider": "openai",
  "api_key": "sk-proj-..."
}
```

#### POST /api/models/keys/test
Test a BYOK API key before saving.

#### DELETE /api/models/keys/:provider
Remove a BYOK API key.

---

### Custom Agents

#### GET /api/agents
List all custom agents.

#### POST /api/agents
Create a custom agent.

```json
{
  "name": "Security Auditor",
  "description": "Reviews code for OWASP vulnerabilities and security anti-patterns",
  "system_prompt": "You are a Senior Application Security Engineer...",
  "model": "meta-llama/llama-3.3-70b-instruct:free",
  "color": "#EF4444",
  "icon": "Shield",
  "heartbeat_enabled": true
}
```

#### PUT /api/agents/:id
Update an existing custom agent.

#### DELETE /api/agents/:id
Remove a custom agent.

---

### SSE Stream

#### GET /api/sse/:sessionId
Server-Sent Events stream. Frontend connects on session start.

**Event Types:**

| Event | Payload | Description |
|---|---|---|
| `task_created` | `{ task }` | Jarvis created a new task (Todo column) |
| `task_claimed` | `{ taskId, agentName, agentType }` | Agent claimed task (In Progress) |
| `task_complete` | `{ task }` | Task done, output ready (Done column) |
| `task_failed` | `{ taskId, error }` | Task failed (error state on card) |
| `task_comment` | `{ taskId, comment }` | Agent commented on a task card |
| `chat_message` | `{ message }` | Agent posted to the chat feed |
| `task_spawned` | `{ newTask, spawnedByAgent, fromChatMessageId }` | Heartbeat created new task |
| `session_complete` | `{ final_report, total_tokens, cost_usd }` | All done, report ready |
| `heartbeat_tick` | `{ agentType, tasksScanned }` | Heartbeat fired (debug mode only) |
| `error` | `{ message }` | Session-level error |

---

## 12. Orchestrator Logic (Detailed)

### Phase 1: Goal Decomposition

```
1. Create session (status: pending)
2. Load all active agents from DB (built-in + custom)
3. Build agent list string for Jarvis:
   "Active agents: researcher (researches features), coder (writes TypeScript code), ..."
4. Call Jarvis with:
   SYSTEM: Manager decomposition prompt (see Section 14)
   USER:   "Goal: {goal}\n\nActive agents:\n{agentListDescription}"
5. Parse Jarvis JSON response -> array of { agent_type, title, description }
6. Validate: each agent_type must exist in the registry
7. Create all task records (status: todo)
8. Update session (status: running)
9. Emit SSE: task_created for each task
```

### Phase 2: Task Claiming and Parallel Execution

```
For each task (all run concurrently via Promise.allSettled):

  a. Update task status -> 'in_progress' + record started_at
  b. Emit SSE: task_claimed { taskId, agentName }
  c. Load agent's system prompt (built-in template or custom from DB)
  d. Route model call via model-router.service.ts
  e. Call LLM with { system: agentSystemPrompt, user: task.description }
  f. On success:
       - Save output to task record
       - Update status -> 'done' + record completed_at + tokens_used
       - Emit SSE: task_complete { task }
       - Trigger IMMEDIATE heartbeat for all other agents (not scheduled)
  g. On failure:
       - Update status -> 'failed' + save error message as output
       - Emit SSE: task_failed { taskId, error }
       - Continue -- do NOT block other tasks
```

### Phase 3: Heartbeat System (The Collaboration Loop)

This is the core of what made Bhanu's system special. Every 15 minutes (configurable), agents
scan the board and post commentary — reviews, refutations, insights, and praises. They also
post to the chat feed. Jarvis reads the chat and spawns new tasks from it.

```
IMMEDIATE HEARTBEAT (triggered on task_complete, once per completed task):
  1. For each OTHER active agent (not the one who just completed the task):
     a. Build context:
        "Agent {name} just completed: '{task.title}'
         Output: {task.output}"
     b. Call that agent with the heartbeat commentary prompt (see Section 13)
     c. Parse response for COMMENT_TYPE and CONTENT
     d. If not "NO_COMMENT":
        - Save as task_comment record
        - Emit SSE: task_comment { taskId, comment }

SCHEDULED HEARTBEAT (node-cron, every N minutes, configurable):
  1. Load all tasks with status='done' from the last 2 heartbeat cycles
  2. Load all recent chat messages (last 30 minutes)
  3. For each active agent:
     a. Build context with recent activity summary
     b. Call agent with chat contribution prompt (see Section 13)
     c. If response is not "NO_MESSAGE":
        - Save as chat_message record
        - Emit SSE: chat_message { message }
     d. If agent is Jarvis: also run task spawning check (see Section 13)
        - Parse JSON response for new_tasks array
        - For each new task: create record, emit SSE: task_spawned + task_created
        - Dispatch new tasks to their assigned agents immediately
```

### Phase 4: Synthesis

```
When all tasks in the session are settled (done | failed | cancelled):
  1. Collect all completed task outputs + their comments
  2. Collect significant chat messages (those that spawned tasks, or are marked 'refute')
  3. Call Jarvis with synthesis prompt (see Section 14)
  4. Save final_report to session
  5. Calculate total tokens + estimated cost (OpenRouter free = $0.00)
  6. Update session status -> 'completed'
  7. Emit SSE: session_complete { final_report, total_tokens, cost_usd }
  8. Close SSE connection after 5s
```

---

## 13. Heartbeat Agent Prompts (Full Text)

### Prompt A: Per-Task Commentary (runs immediately after any task completes)
```
You are {agentName} on a multi-agent development team.
A teammate just completed a task. Review their work and provide commentary
if you have anything valuable to add, correct, refute, or praise.

Task completed by: {completedByAgentName}
Task title: {taskTitle}
Their output:
---
{taskOutput}
---

Respond in one of these two formats:

Format 1 (if you have something to say):
COMMENT_TYPE: [insight | review | refute | praise | question]
CONTENT:
[Your markdown commentary here. Be specific. Reference their work directly.]

Format 2 (if you have nothing to add):
NO_COMMENT
```

### Prompt B: Chat Feed Contribution (runs on scheduled heartbeat)
```
You are {agentName} on a multi-agent development team working on: "{sessionGoal}"

Recent team activity:
{recentTaskSummary}

Recent team chat:
{recentChatMessages}

If you have an insight, observation, concern, or question worth sharing with
the team, post it now. Be specific. Reference actual outputs or tasks.

If you have nothing to share right now, respond with exactly: NO_MESSAGE
```

### Prompt C: Jarvis Task Spawning (runs alongside Prompt B, Jarvis only)
```
You are Jarvis, the Squad Lead. Review the team's recent chat for insights
that should become new tasks.

Session goal: "{sessionGoal}"
Active agents: {agentList}
Already-existing tasks (do NOT duplicate): {existingTaskTitles}

Recent chat messages:
{recentChatMessages}

If any message identifies work that should be done and does NOT already exist
as a task, create it. Return JSON or NO_NEW_TASKS:

{
  "new_tasks": [
    {
      "agent_type": "tester",
      "title": "Write tests for auth token expiry edge case",
      "description": "Detailed instructions...",
      "spawned_by": "tester"
    }
  ]
}
```

---

## 14. Jarvis System Prompts (Full Text)

### Goal Decomposition
```
You are Jarvis, the Squad Lead of an AI coding team. Break down the developer's
goal into specific, parallel tasks and assign each to the right specialist.

Rules:
- Create 3-6 tasks maximum
- Each task must be independently completable (no inter-task dependencies)
- Every task description must be fully self-contained — the agent cannot ask questions
- The agent_type field must exactly match one of the provided active agent slugs
- Return ONLY valid JSON — no text before or after, no markdown code fences

Active agents you can assign to:
{agentList}

Return this exact JSON structure:
{
  "tasks": [
    {
      "agent_type": "researcher",
      "title": "Research JWT authentication patterns for Node.js",
      "description": "Research the best JWT auth approach for an Express.js API
      in TypeScript. Cover: which library (jsonwebtoken vs jose), access +
      refresh token pattern, secure httpOnly cookie storage, token rotation
      strategy. Return a markdown report with code examples."
    }
  ]
}
```

### Synthesis Report
```
You are Jarvis, the Squad Lead. Your team has completed all tasks.
Write a comprehensive final report.

Original goal: "{goal}"

Team outputs and commentary:
{formattedTaskOutputsWithComments}

Team chat highlights:
{significantChatMessages}

Write a final report in markdown that:
1. Summarizes each agent's findings (2-3 sentences each)
2. Provides a numbered implementation roadmap (ordered, actionable steps)
3. Highlights the most important code snippets to use
4. Lists any concerns, conflicts, or disagreements from the agent collaboration
5. Ends with "Quick Start — Do This First" (3-5 bullet points)
```

---

## 15. UI Specification (Complete)

### 15.1 App Layout

```
+--------------------------------------------------------------------+
|  AgentForge    [History]  [Manage Agents]  [Settings]             |
+--------------------------------------------------------------------+
|                                                                    |
|  +--------------------------------------------------------------+  |
|  |  What do you want to build?                                  |  |
|  |  [                                                       ]   |  |
|  |  [                                                       ]   |  |
|  |                                    [Run Agent Team]          |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  SQUAD STATUS --------------------------------------------------   |
|  [orange] Jarvis      Thinking...                                  |
|  [blue]   Researcher  Idle                                         |
|  [green]  Coder       Working on: Research JWT libraries           |
|  [amber]  Tester      Reviewing output from Coder                  |
|  [purple] R&D         Idle                                         |
|                              [Tokens: 4,231  |  Cost: $0.00]       |
|                                                                    |
|  +---------------------------+  +------------------------------+  |
|  |     KANBAN BOARD          |  |   AGENT CHAT FEED            |  |
|  |                           |  |                              |  |
|  | [TODO] [IN PROG] [DONE]   |  | [blue] Researcher: I found.. |  |
|  | [card] [card]    [card]   |  | [green] Coder: Agreed, but.. |  |
|  | [card]           [card]   |  | [orange] Jarvis: -> Created  |  |
|  |                           |  |           new task [see card] |  |
|  +---------------------------+  +------------------------------+  |
|                                                                    |
|  FINAL REPORT (appears on session_complete) --------------------   |
|  [Markdown rendered report with copy + download buttons]          |
+--------------------------------------------------------------------+
```

### 15.2 Kanban Board

**Three fixed columns:** Todo | In Progress | Done

**Task Card appearance:**
```
+--------------------------------------------+
|  [blue dot] Researcher                     |  <- Agent badge
|  Research JWT auth patterns for Node.js    |  <- Task title
|  ------------------------------------------  |
|  [dot] In Progress  •  1m 23s elapsed      |  <- Pulsing dot when active
|  [icon] 3 comments from team               |  <- Comment count badge
|                          [View Output ->]  |  <- Appears when done
+--------------------------------------------+
```

Auto-spawned task cards (created by heartbeat) show a special badge:
```
|  [amber dot] Tester  [lightning] Auto-created  |
```

**Task Detail Modal** (click on any card):
- Full markdown-rendered primary output (react-markdown + syntax highlighting)
- "Comments from the team" section below — threaded, one per agent comment
- Each comment shows: agent badge, comment type pill (insight / review / refute / praise / question), content
- "Copy Output" and "Download as .md" buttons

### 15.3 Agent Chat Feed

Real-time scrolling panel beside the Kanban board.

```
+------------------------------------------+
|  AGENT CHAT FEED               [clear]   |
|  ----------------------------------------|
|  [blue] RESEARCHER  •  2m ago            |
|  I found that users who implement JWT    |
|  rotation with Redis get a much better   |
|  security posture. Should we add Redis?  |
|  ----------------------------------------|
|  [green] CODER  •  1m ago               |
|  Good call. I'll adjust the              |
|  implementation to include Redis.        |
|  ----------------------------------------|
|  [orange] JARVIS  •  just now           |
|  -> Created new task:                    |
|     "Add Redis token blacklist layer"    |
|     Assigned to: Coder  [See task ->]   |
+------------------------------------------+
```

When Jarvis spawns a new task from the chat, it appears as a special message with a clickable link to the new task card on the Kanban board.

### 15.4 Settings Panel (3 tabs)

**Tab 1: Models**
- Default model row per built-in agent (dropdown)
- Free models shown normally
- BYOK models shown with "$ BYOK" pill — grayed if key not configured

Model dropdown design:
```
-- FREE MODELS (No API key needed) --
  DeepSeek R1            [Best for code]
  Llama 3.3 70B          [Best for reasoning]
  Gemini 2.0 Flash       [Fast]
  Mistral 7B             [Lightweight]

-- YOUR API KEYS --
$ GPT-4o                 [OpenAI - configured]
$ Claude Sonnet 4.6      [Anthropic - configured]
! Gemini 1.5 Pro         [Google - not configured]

[+ Add API Key ->]
```

**Tab 2: API Keys**
```
Provider     Status              Actions
-----------  ------------------  ----------------
OpenAI       sk-proj-...****     [Edit] [Test] [Remove]
Anthropic    Not configured      [Add Key]
Google       Not configured      [Add Key]
Groq         Not configured      [Add Key]
```
Warning shown on page: "Keys are encrypted with AES-256 and stored locally. They are never sent to AgentForge servers — only to the provider's API directly."

**Tab 3: Heartbeat**
- Global heartbeat toggle (on/off)
- Interval selector: 5 min | 10 min | 15 min | 30 min | 1 hour
- Per-agent toggle (each built-in + custom agent)
- Info text: "Agents scan completed tasks and post insights at this interval. Disable to conserve tokens."

### 15.5 Agent Manager Modal

List view:
- Built-in agents — can change model only (cannot delete or rename)
- Custom agents — full edit + delete

Create/Edit Custom Agent form:
- Name (text input)
- Description (short text — shown as subtitle in agent card)
- System Prompt (large monospace textarea)
- Model (same dropdown as Settings)
- Color (8 preset swatches + custom hex input)
- Icon (searchable Lucide icon grid, 20 icons shown at a time)
- Heartbeat enabled (toggle)

---

## 16. Environment Configuration

### Backend `.env.example`
```env
# ---- Required -----------------------------------------------
OPENROUTER_API_KEY=your-openrouter-api-key-here

# ---- Server -------------------------------------------------
PORT=3001
NODE_ENV=development

# ---- MySQL Database -----------------------------------------
# Create the database first: CREATE DATABASE agentforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=agentforge

# ---- OpenRouter ---------------------------------------------
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MAX_RETRIES=3
OPENROUTER_TIMEOUT_MS=90000

# ---- Defaults -----------------------------------------------
MANAGER_MODEL=meta-llama/llama-3.3-70b-instruct:free
DEFAULT_HEARTBEAT_INTERVAL_MINUTES=15
MAX_AUTO_SPAWNED_TASKS=10
```

### Frontend `.env.example`
```env
VITE_API_BASE_URL=http://localhost:3001
```

---

## 17. Error Handling Rules

| Scenario | Behavior |
|---|---|
| `OPENROUTER_API_KEY` missing | Crash on boot with: "OPENROUTER_API_KEY is required. Add it to backend/.env" |
| MySQL connection fails on boot | Crash with the mysql2 connection error. Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in backend/.env |
| One task fails | Mark as `failed`. Continue all others. Error message shown on card. |
| BYOK API key invalid | That agent's task fails with a clear error. UI links to Settings > API Keys. |
| Manager JSON parse fails | Retry once. If still fails: session -> cancelled. Show "Jarvis could not plan this goal. Try rephrasing." |
| Rate limit (429) | Exponential backoff: 1s -> 2s -> 4s -> 8s. Max 4 retries. Then fail the task. |
| All tasks fail | Session -> failed. Skip synthesis. Show error summary panel. |
| SSE connection drops | EventSource auto-reconnects. On reconnect: re-fetch session state via GET /sessions/:id |
| User cancels | AbortController.abort() on all in-progress fetches. Tasks -> cancelled. Stop heartbeat cron. |
| Heartbeat returns "NO_COMMENT" / "NO_MESSAGE" | No record created. No SSE event. Silently skip. |
| Auto-spawned task count >= MAX_AUTO_SPAWNED_TASKS | Jarvis stops spawning tasks. Can still post to chat. Show counter in UI. |

---

## 18. Key Implementation Notes for Claude Code

1. **`app.ts` vs `server.ts` separation** — `app.ts` configures Express only. `server.ts` calls `app.listen()`. Never merge these two files.

2. **Zod env validation at boot** — `config/env.ts` must use Zod to validate all required vars. App must not start if `OPENROUTER_API_KEY` is missing. MySQL connection is validated at startup via `runMigrations()` — any connection error propagates and kills the process.

3. **AES-256 encryption for BYOK keys** — Use Node.js built-in `crypto.createCipheriv('aes-256-gcm', ...)`. Store the IV + authTag + ciphertext concatenated in the `api_key_encrypted` column. The encryption key is derived from the backend's `OPENROUTER_API_KEY` or a separate secret — never log raw keys, never return them to the frontend.

4. **AbortController per session** — `Map<sessionId, AbortController>` in orchestrator memory. Cancel action calls `abort()`. Pass `signal` to every `fetch()` call. On abort, all in-flight LLM calls stop immediately.

5. **SSE Manager** — `sse/sse-manager.ts` maintains `Map<sessionId, Response>`. On `res.on('close')`, remove from map. On session complete, emit `session_complete` event then call `res.end()` after 5000ms delay.

6. **Heartbeat via node-cron** — `heartbeat.service.ts` creates a cron job per session. Store `Map<sessionId, ScheduledTask>` from node-cron. On session cancel/complete, call `task.stop()` and delete from map.

7. **Immediate heartbeat on task_complete** — The scheduled heartbeat and the immediate task-completion notification are SEPARATE. When any task finishes, fire the immediate heartbeat (Mode 2) for all other agents right away. Don't wait for the scheduled tick.

8. **Heartbeat LLM parsing** — Parse `COMMENT_TYPE:` using a simple string split on newlines. If parsing fails, default to `comment_type: 'insight'`. If `NO_COMMENT` is in the response, return null — do not create a record.

9. **Auto-spawned task cap** — Before Jarvis creates a new task from chat, query: `SELECT COUNT(*) FROM tasks WHERE session_id = ? AND spawned_by_agent IS NOT NULL`. If >= MAX_AUTO_SPAWNED_TASKS, skip task creation.

10. **TypeScript strict mode** — `tsconfig.json` must have `strict: true`. All DB row types defined in `types/index.ts`. No `any` types anywhere.

11. **No ORM** — Raw `mysql2` queries only via the async connection pool. All queries are typed functions in `db/queries.ts`. Use `pool.execute()` for parameterized queries (auto-prepared statements). Use `RowDataPacket` from `mysql2` for typed row results.

12. **Redux Toolkit store** — Use Redux Toolkit slices with React Redux hooks. Core slices: `sessionStore` (session, tasks, comments, chat messages, SSE state), `agentStore` (built-in + custom agents), `projectStore` (projects + current project), `modelStore` (model list + per-agent overrides), `themeStore` (theme preference), and `feedStore` (live event stream). Persist only non-sensitive UI preferences such as theme and model overrides in localStorage; never store raw provider API keys in frontend state.

13. **Tailwind CSS 4 setup** — Use Tailwind 4 in CSS-first mode. Theme tokens live in `src/index.css` using `@theme inline`, dark mode is defined with `@custom-variant dark (&:where(.dark, .dark *))`, and the frontend build integrates Tailwind through `@tailwindcss/vite`. Do not use `tailwind.config.ts` or PostCSS-based Tailwind wiring unless a future requirement truly needs compatibility mode.

---

## 19. Package Dependencies

### Root `package.json`
```json
{
  "name": "agentforge",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\"",
    "install:all": "npm install && npm install --prefix backend && npm install --prefix frontend"
  },
  "devDependencies": {
    "concurrently": "^9.2.1"
  }
}
```

### Backend `package.json`
```json
{
  "dependencies": {
    "@types/pdfkit": "^0.17.6",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "exceljs": "^4.4.0",
    "express": "^5.2.1",
    "mysql2": "^3.22.3",
    "node-cron": "^4.2.1",
    "pdfkit": "^0.18.0",
    "uuid": "^14.0.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3"
  }
}
```

### Frontend `package.json`
```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@reduxjs/toolkit": "^2.11.2",
    "axios": "^1.16.0",
    "lucide-react": "^1.14.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-markdown": "^10.1.0",
    "react-redux": "^9.2.0",
    "react-syntax-highlighter": "^16.1.1",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.4",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/react-syntax-highlighter": "^15.5.13",
    "@vitejs/plugin-react": "^6.0.1",
    "tailwindcss": "^4.2.4",
    "typescript": "^6.0.3",
    "vite": "^8.0.10"
  }
}
```

---

## 20. README Content (for Claude Code to generate)

```markdown
## Setup (5 minutes)

1. Clone the repo
2. npm run install:all
3. cp backend/.env.example backend/.env
4. Create a MySQL database:
   mysql -u root -p -e "CREATE DATABASE agentforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
5. Fill in DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in backend/.env
6. Get a free OpenRouter API key at https://openrouter.ai (free signup, no credit card)
7. Add OPENROUTER_API_KEY to backend/.env
8. npm run dev
9. Open http://localhost:5173

Tables are created automatically on first startup — no manual migration step needed.

## Using Free Models (Zero Cost)

AgentForge defaults to free OpenRouter models only:
- DeepSeek R1 — best free coding model
- Llama 3.3 70B — best for planning and reasoning
- Gemini 2.0 Flash — fast research tasks

No OpenAI or Anthropic key needed to get started.

## Using Paid Models (BYOK — Bring Your Own Key)

1. Go to Settings (top nav) -> API Keys tab
2. Add your OpenAI, Anthropic, Google, or Groq key
3. Click "Test Key" to verify it works
4. Go to Settings -> Models tab and assign that model to any agent

Your key is encrypted with AES-256 and stored locally on your machine.
It is never sent anywhere except directly to the provider's API.

## How the Collaboration Works

1. Type a goal -> Jarvis plans tasks and assigns specialists
2. Agents work in parallel — no waiting in a queue
3. When any agent finishes, ALL other agents immediately review the output
   and post comments (praise, refute, add insights)
4. Agents also post to a shared chat feed with broader observations
5. Jarvis reads the chat feed and creates new tasks automatically if needed
6. You get a final synthesis report when everything settles

## Adding Custom Agents

Click "Manage Agents" in the nav -> "Add Custom Agent"
Write a system prompt, pick a model (free or paid), choose a color and icon.
Your agent joins the squad immediately and participates in heartbeats.
```

---

## 21. Acceptance Criteria

The build is complete when ALL of the following pass:

- [ ] User types a goal -> Jarvis creates tasks -> Kanban shows Todo cards
- [ ] Tasks move Todo -> In Progress -> Done in real time via SSE
- [ ] After each task completes, OTHER agents post comments on that task card
- [ ] Comment types (insight / review / refute / praise / question) are correctly parsed and shown
- [ ] Agent Chat Feed shows real-time messages between agents
- [ ] Jarvis spawns a new task from a chat message and it appears on the board
- [ ] Auto-spawned task cap (10) prevents infinite loops
- [ ] Settings -> Models shows free model list and BYOK paid models
- [ ] User adds an OpenAI key -> it is saved encrypted -> "Test Key" works -> GPT-4o is selectable
- [ ] An agent configured with a BYOK model calls that provider's API, not OpenRouter
- [ ] Heartbeat fires on schedule and generates comments / chat messages
- [ ] Custom agent created via UI participates in the next session's tasks and heartbeats
- [ ] Final report appears after session_complete SSE fires
- [ ] Token usage and estimated cost ($0.00 for free models) shown live during session
- [ ] User cancels session -> all in-progress LLM calls abort cleanly via AbortController
- [ ] Session history shows past sessions -> click to view read-only Kanban state
- [ ] Missing OPENROUTER_API_KEY crashes on boot with a readable error
- [ ] Bad MySQL credentials crash on boot with a readable connection error
- [ ] `tsc --noEmit` passes with zero errors on both backend and frontend
- [ ] App starts with `npm run dev` from root directory

---

## 22. v2 Roadmap (Out of Scope for v1)

- Streaming agent responses (character-by-character output while agent is working)
- File upload — agents can read your actual code files as context
- Code execution sandbox — agents can run their generated code and see the output
- Telegram integration — send goals via Telegram, receive updates like Bhanu does
- GitHub integration — agents commit outputs directly to a branch
- Agent memory — cross-session context (agents remember past sessions)
- Docker deployment config
- Export session as PDF report
- Multiple squad groups (marketing squad, dev squad, etc. as separate tabs)
- Per-agent token budget limits (stop an agent from spending too many tokens)
```

# Research
- The setup was wild. Each agent had a name from the MCU. Jarvis, the lead. Shuri, the engineer. Fury, the project manager. They communicated through a shared Convex database. They @mentioned each other. They ran daily standups. They operated autonomously around the clock.
- The agents don't just work in isolation. They communicate, delegate, review each other's work, and maintain shared context. It's the closest thing to an AI team.
- There should be smaller sub-agents specialized for certain tasks. For example, there should be multiple coder agents, each specializing in a different programming language. or a agent that is specialized in excel tasks.
- and the manager can use this agent as per the requirements. so if a task is assigned to a agent, the agent can delegate the task to the sub-agents as per the requirements.
- and can create this agents as per the need and keep them in the backup, so they are not actively working or taking part in all decisions and only work for the task they are given.

User
  ↓
LLM (Claude/GPT/etc.)
  ↓
Tool Calling System
  ↓
Sandbox / Code Executor
  ↓
Python Script Executes
  ↓
File Generated (pdf/xlsx/png/etc.)
  ↓
File Storage
  ↓
Download Link Returned

Usually:
- Docker containers
- MicroVMs
- Firecracker VMs
- Kubernetes pods
- WASM sandboxes
- Isolated Python runtimes
These are temporary isolated environments.

What is a Sandbox?
A sandbox is: A temporary isolated machine/environment where untrusted code can safely run.
Think of it like: Mini computer created just for one task
After task finishes: Destroy the machine

This prevents generated code from damaging the real server.

| Technology        | Purpose                |
| ----------------- | ---------------------- |
| Docker            | Container isolation    |
| Firecracker       | Lightweight VMs        |
| Kubernetes        | Scaling sandboxes      |
| Python subprocess | Run generated code     |
| E2B               | AI sandbox platform    |
| Pyodide/WASM      | Browser-safe execution |
| Deno              | Secure JS runtime      |
| Linux namespaces  | Isolation              |
| cgroups           | CPU/RAM limits         |

So production systems use:
- CPU limits
- memory limits
- no root access
- read-only filesystem
- network restrictions
- execution timeout
- ephemeral containers

Frontend
   ↓
Backend API
   ↓
LLM
   ↓
Agent Loop
   ↓
Tool Registry
   ↓
Sandbox Runtime
   ↓
Filesystem

What is an Agent Loop? (Reason → Act → Observe → Repeat)
The AI doesn't just respond once. It loops.
Example flow:
Thought:
Need Python

Action:
Run code

Observation:
Error occurred

Thought:
Need to fix import

Action:
Run corrected code

# Available tools

The agent toolset includes the following tools. All are enabled by default when you include the toolset in your agent configuration.

| Tool | Name | Description |
|--------|------|-------------|
| Bash | bash | Execute bash commands in a shell session |
| Read | read | Read a file from the local filesystem |
| Write | write | Write a file to the local filesystem |
| Edit | edit | Perform string replacement in a file |
| Glob | glob | Fast file pattern matching using glob patterns |
| Grep | grep | Text search using regex patterns |
| Web fetch | web_fetch | Fetch content from a URL |
| Web search | web_search | Search the web for information |

The Gateway: The Control Plane
Everything in OpenClaw flows through a single process called the Gateway. The official docs describe it as the “single source of truth” for sessions, routing, and channel connections. Think of it as the nervous system of the whole system.

The Gateway is typically run as a long-lived background process (often via systemd on Linux, or a LaunchAgent on macOS). Clients connect to it over WebSocket at the configured bind host, which defaults to ws://127.0.0.1:18789.

The Gateway handles routing, connectivity, authentication, and session management. The Agent Runtime handles reasoning and execution. This separation of concerns is intentional and important.

| Layer                  | Responsibility                |
| ---------------------- | ----------------------------- |
| Project Context System | understand repo/files/modules |
| Agent Orchestrator     | coordinate multiple agents    |
| Sandbox Runtime        | isolated execution            |
| Tool Layer             | edit/run/test/git             |
| Workspace Manager      | clone repos/manage files      |


1. Orchestrator (YOUR backend)
2. Sandbox Runtime (Docker)
3. Agents (LLMs)

# Coding Agent Prompt
You are an advanced autonomous coding agent working inside an isolated project workspace.

Your job is to:
- analyze repositories
- plan tasks
- edit files
- run tests
- debug issues
- improve code quality
- collaborate with other agents
- generate clean production-ready code

You are NOT running directly on the host machine.

You are operating inside a sandboxed workspace environment.

--------------------------------------------------
WORKSPACE ENVIRONMENT
--------------------------------------------------

The repository is mounted inside:

/workspace

You may only access files inside this workspace.

The system provides tools for:
- reading files
- writing files
- listing directories
- searching code
- running terminal commands
- running tests
- viewing git diff
- installing dependencies

You MUST use provided tools instead of assuming filesystem access.

--------------------------------------------------
IMPORTANT SAFETY RULES
--------------------------------------------------

NEVER:
- access files outside /workspace
- attempt privilege escalation
- modify system files
- run destructive commands
- delete unrelated files
- execute dangerous shell operations
- use rm -rf on broad paths
- install global system packages
- run background infinite processes

Only perform actions necessary for the assigned task.

--------------------------------------------------
AGENT EXECUTION MODEL
--------------------------------------------------

You operate in a Reason → Act → Observe loop.

For every task:
1. Understand the problem
2. Inspect relevant files
3. Plan changes carefully
4. Make minimal precise edits
5. Run validation/tests
6. Analyze failures
7. Fix issues
8. Repeat until successful

Never blindly edit files without understanding surrounding code.

Always inspect related files before making architecture changes.

--------------------------------------------------
PROJECT UNDERSTANDING
--------------------------------------------------

Before modifying code:
- inspect project structure
- understand module boundaries
- identify frameworks/libraries
- inspect package managers
- understand coding conventions
- understand architecture patterns

You should maintain consistency with the existing codebase.

--------------------------------------------------
FILE EDITING RULES
--------------------------------------------------

When editing files:
- preserve formatting style
- preserve naming conventions
- avoid unnecessary refactors
- modify only what is required
- keep changes minimal and focused
- avoid rewriting entire files unless necessary

Always prefer surgical edits over large rewrites.

--------------------------------------------------
TESTING REQUIREMENTS
--------------------------------------------------

After code changes:
- run relevant tests
- run builds if necessary
- validate linting if available
- verify runtime errors are resolved

Never claim success without validation.

--------------------------------------------------
TOOL USAGE POLICY
--------------------------------------------------

Available tools may include:
- read_file
- write_file
- list_files
- search_code
- run_command
- run_tests
- git_diff
- install_dependencies

Use tools strategically.

Avoid unnecessary tool calls.

Do not repeatedly read the same file unless needed.

--------------------------------------------------
TERMINAL COMMAND POLICY
--------------------------------------------------

Allowed:
- npm install
- npm test
- npm run build
- composer install
- composer test
- php artisan test
- python scripts
- git diff
- grep
- ls
- cat

Avoid:
- long-running dev servers
- interactive commands
- dangerous filesystem operations
- system-level modifications

--------------------------------------------------
COLLABORATION RULES
--------------------------------------------------

You may receive outputs from:
- planner agents
- reviewer agents
- tester agents

Incorporate their feedback carefully.

Do not overwrite unrelated changes from other agents.

--------------------------------------------------
ERROR HANDLING
--------------------------------------------------

When errors occur:
1. inspect full error output
2. identify root cause
3. fix systematically
4. rerun validation

Do not guess blindly.

--------------------------------------------------
OUTPUT FORMAT
--------------------------------------------------

Be concise and execution-focused.

Before making major changes:
- explain reasoning briefly

After completing tasks:
- summarize changes
- summarize files modified
- summarize tests executed
- summarize remaining issues if any

Do not generate unnecessary explanations.

Focus on execution accuracy.

--------------------------------------------------
GIT AWARENESS
--------------------------------------------------

Respect existing git structure.

Avoid touching unrelated files.

Preserve developer intent.

Keep commits logically scoped.

--------------------------------------------------
PRIMARY GOAL
--------------------------------------------------

Your primary objective is to safely and accurately complete coding tasks inside the sandboxed workspace while maintaining production-quality standards.