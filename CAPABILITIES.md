# AgentForge — What Can It Do?

A practical guide to what you can ask AgentForge and what the AI team will produce.

---

## How It Works

When you type a goal into the dashboard, this is what happens behind the scenes:

1. **Manager** reads your goal and breaks it into specific tasks
2. Each task is assigned to the best-fit agent (Researcher, Coder, Tester, or R&D Analyst)
3. All agents work **in parallel** — you see tasks move across the Kanban board in real time
4. When one agent finishes, **every other agent reviews** the output and posts comments (insights, corrections, praise, or questions)
5. Agents chat with each other in the Activity feed — if someone raises a concern, the Manager may spawn a new task automatically
6. Once everything settles, the **Manager writes a final synthesis report** pulling together all findings

All output is **text and markdown** — code snippets, reports, tables, analysis. Agents do not currently execute code or modify files on disk.

---

## The Agents

| Agent | Specialization | Default Model |
|-------|---------------|---------------|
| **Manager** | Breaks down goals, assigns tasks, writes final report | Llama 3.3 70B |
| **Researcher** | Libraries, patterns, best practices, API docs | Gemma 4 31B |
| **Coder** | Production-ready TypeScript/Node.js/React code | Qwen3 Coder |
| **Tester** | Unit tests, integration tests, edge cases | Llama 3.3 70B |
| **R&D Analyst** | Competitor analysis, market research, feature comparison | Nemotron Super 120B |

You can also create **custom agents** with their own name, system prompt, and model from the dashboard.

---

## Example Prompts & What You Get

### 1. Build a Feature

**Prompt:**
> Add JWT authentication with refresh tokens to my Express.js API

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research JWT + refresh token best practices | Report covering `jsonwebtoken` vs `jose`, token rotation strategies, storage options (httpOnly cookies vs localStorage), OWASP recommendations |
| Coder | Write the auth middleware and token service | Complete TypeScript files: `auth.middleware.ts`, `token.service.ts`, `auth.controller.ts` with login/register/refresh endpoints |
| Coder | Write the user model and validation | `user.model.ts` with Zod schemas, password hashing with bcrypt, DB query functions |
| Tester | Write tests for auth flow | Jest test suite covering login, registration, token refresh, expired tokens, malformed tokens, and middleware rejection |
| R&D Analyst | Analyze how Auth0, Clerk, and Supabase handle auth | Comparison table of auth providers, UX patterns they use, features worth adopting |

**Final Report:** A unified markdown document with implementation steps, the recommended approach, all code files, test coverage notes, and competitive insights — ready to copy into your project.

---

### 2. Design a Database Schema

**Prompt:**
> Design a database schema for a multi-tenant SaaS project management tool like Linear

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research multi-tenancy patterns for SaaS databases | Report on shared-schema vs schema-per-tenant vs database-per-tenant, with pros/cons and when to use each |
| Coder | Write the SQL schema with all tables and relationships | Complete SQL DDL: `organizations`, `projects`, `issues`, `labels`, `sprints`, `comments`, `users`, `memberships` with foreign keys, indexes, and constraints |
| Coder | Write TypeScript type definitions matching the schema | Interface definitions, Zod validation schemas, and query helper functions |
| Tester | List edge cases and data integrity scenarios | Scenarios: orphaned records, cascading deletes, concurrent updates, tenant data isolation, migration rollback safety |
| R&D Analyst | Analyze Linear, Jira, and Asana's data models | Feature comparison, what Linear does differently, which schema patterns enable their speed |

---

### 3. Research a Technology

**Prompt:**
> Compare tRPC vs GraphQL vs REST for a Next.js + Node.js monorepo

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Deep-dive comparison of tRPC, GraphQL, and REST | Structured report: type safety, DX, performance, learning curve, ecosystem maturity, and when each is the best fit |
| Coder | Write example API endpoints in all three approaches | Side-by-side code: the same `GET /users/:id` + `POST /users` endpoint implemented in tRPC, GraphQL (Apollo), and Express REST |
| Tester | Compare testing strategies for each approach | How to test each one, mock patterns, integration test setup differences, and which approach has the simplest testing story |
| R&D Analyst | Analyze adoption trends and industry usage | Which companies/products use each approach, GitHub stars trajectory, npm download trends, community sentiment |

---

### 4. Plan a Migration

**Prompt:**
> Migrate a React class component codebase to functional components with hooks

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research migration strategies and common pitfalls | Report on incremental vs big-bang migration, lifecycle → hooks mapping (`componentDidMount` → `useEffect`), HOC → custom hook conversions, refs migration |
| Coder | Write conversion examples for common patterns | Before/after code for: class state → `useState`, lifecycle methods → `useEffect`, context consumers → `useContext`, error boundaries (still class-only) |
| Coder | Write reusable custom hooks to replace common HOC patterns | `useDebounce`, `useLocalStorage`, `usePrevious`, `useOnClickOutside` — hooks that replace commonly repeated class logic |
| Tester | Write tests to verify behavioral parity after migration | Test suites that assert the same behavior before and after conversion, including edge cases around effect cleanup and state batching |
| R&D Analyst | Analyze how large codebases (Meta, Shopify) handled this migration | Insights on tooling they used (codemods), timeline, what broke, lessons learned |

---

### 5. Build a Full-Stack Feature End-to-End

**Prompt:**
> Build a real-time notification system with WebSockets for a chat application

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research WebSocket libraries and scaling strategies | Comparison of `ws`, `Socket.IO`, and `µWebSockets.js`; scaling with Redis pub/sub; sticky sessions vs shared state |
| Coder | Write the WebSocket server with event handling | Complete code: `notification.gateway.ts`, connection management, room-based broadcasting, heartbeat/ping-pong, authentication on upgrade |
| Coder | Write the React client hook for WebSocket consumption | `useNotifications` hook with auto-reconnect, exponential backoff, message queuing during disconnects, toast integration |
| Coder | Write the notification persistence layer | `notification.model.ts`, database queries for unread counts, mark-as-read, batch operations, and cleanup of old notifications |
| Tester | Write tests for connection lifecycle and message delivery | Tests for: connect/disconnect, reconnection, message ordering, offline queuing, auth rejection, concurrent connections |
| R&D Analyst | Analyze how Slack, Discord, and Linear handle real-time updates | Patterns: optimistic UI, delivery guarantees, notification grouping, quiet hours, and priority levels |

---

### 6. Security Audit

**Prompt:**
> Review common security vulnerabilities in a Node.js Express API and suggest hardening measures

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research OWASP Top 10 for Node.js APIs | Detailed breakdown of each vulnerability (injection, XSS, CSRF, IDOR, etc.) with Node.js-specific examples and mitigation code |
| Coder | Write security middleware and utility functions | Code for: rate limiting, input sanitization, CORS configuration, helmet setup, CSRF tokens, parameterized queries, and secure headers |
| Tester | Write security-focused test cases | Tests for SQL injection attempts, XSS payloads, CSRF bypass attempts, authorization boundary testing, and brute force detection |
| R&D Analyst | Analyze how production APIs (Stripe, GitHub, Twilio) handle security | API key rotation strategies, webhook signature verification, audit logging patterns, and security headers they use |

---

### 7. Performance Optimization

**Prompt:**
> Optimize a slow React dashboard that renders 10,000+ rows of data

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research virtualization and rendering optimization techniques | Report on `react-window` vs `react-virtuoso` vs `TanStack Virtual`, `useMemo`/`useCallback` patterns, web worker offloading |
| Coder | Write a virtualized table component with sorting and filtering | Complete component code using `@tanstack/react-virtual` with column sorting, search filtering, and infinite scroll |
| Coder | Write a data fetching layer with pagination and caching | Server-side pagination endpoint + React Query integration with prefetching, stale-while-revalidate, and optimistic updates |
| Tester | Write performance benchmarks and regression tests | Performance test setup: measure render time, FPS during scroll, memory usage, and threshold-based pass/fail assertions |
| R&D Analyst | Analyze how Airtable, Notion, and Retool handle large datasets | Techniques: progressive loading, skeleton screens, column virtualization, and smart indexing strategies |

---

### 8. API Design

**Prompt:**
> Design a REST API for a multi-vendor e-commerce marketplace

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research API design patterns for marketplaces | Report on resource modeling, nested routes vs flat, pagination strategies, versioning, and rate limiting for multi-vendor scenarios |
| Coder | Write the full API route and controller structure | Complete route definitions with request/response schemas for: products, orders, vendors, reviews, categories, and cart — with Zod validation |
| Coder | Write the data models and database queries | TypeScript interfaces, SQL schema, and query functions for all entities with proper multi-vendor isolation |
| Tester | Write API contract tests | Test suites for each endpoint: happy paths, validation errors, authorization boundaries (vendor A can't edit vendor B's products), and pagination edge cases |
| R&D Analyst | Analyze Shopify, Amazon, and Etsy marketplace APIs | API design patterns, webhook structures, and developer experience features worth adopting |

---

### 9. DevOps & Deployment

**Prompt:**
> Set up a CI/CD pipeline with GitHub Actions for a Node.js monorepo with staging and production environments

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | Research GitHub Actions best practices for monorepos | Report on path filtering, job matrices, caching strategies, environment protection rules, and secret management |
| Coder | Write the GitHub Actions workflow files | Complete YAML: lint → test → build → deploy pipelines for staging (on PR merge) and production (on tag), with caching and parallel jobs |
| Coder | Write Dockerfile and docker-compose for the stack | Multi-stage Dockerfile, docker-compose for local dev with hot reload, and production-optimized builds |
| Tester | List deployment verification tests | Smoke test checklist, health check endpoints, rollback trigger conditions, and canary deployment test scenarios |
| R&D Analyst | Compare deployment strategies across platforms | Comparison of GitHub Actions vs GitLab CI vs CircleCI vs Railway vs Fly.io for monorepo deployments |

---

### 10. Quick Research & Decision Making

**Prompt:**
> Should I use Prisma, Drizzle, or raw SQL for a high-performance Node.js API?

**What the team produces:**

| Agent | Task | Output |
|-------|------|--------|
| Researcher | In-depth comparison of Prisma, Drizzle, and raw SQL | Feature comparison, performance benchmarks, type safety, migration tooling, query complexity limits, and community support |
| Coder | Write the same query in all three approaches | Side-by-side code for complex queries (joins, transactions, aggregations) in Prisma, Drizzle, and raw `mysql2`/`pg` |
| Tester | Compare testability of each approach | How to mock/stub each ORM in unit tests, integration test setup differences, and seed data management |
| R&D Analyst | Analyze adoption trends and production usage | Who uses what at scale, GitHub issues/complaints, migration stories, and long-term maintainability outlook |

---

## What Makes This Different from ChatGPT

| Feature | ChatGPT / Single Agent | AgentForge |
|---------|----------------------|------------|
| Task planning | You manually break down the goal | Manager auto-decomposes into tasks |
| Specialization | One model does everything | Each agent has a focused system prompt and optimal model |
| Cross-review | No review | Every agent reviews every other agent's output and posts corrections/insights |
| Parallel execution | Sequential conversation | All agents work simultaneously |
| Autonomous follow-up | You ask follow-up questions | Agents chat with each other and spawn new tasks on their own |
| Persistent history | Chat disappears | All sessions, tasks, and outputs saved in MySQL |
| Model flexibility | One model | Different model per agent, free or BYOK |

---

## Current Limitations

- **Text output only** — agents produce code snippets in markdown but cannot read, write, or execute files on your machine
- **No streaming** — you see the full output when a task completes, not token-by-token
- **No context from your codebase** — agents don't know your project structure; you describe it in the prompt
- **Free model quality varies** — free models can produce lower-quality output or hit rate limits; use BYOK for production-grade results
- **Single user** — no team collaboration or access control

---

## Tips for Best Results

1. **Be specific** — "Add JWT auth to Express with refresh tokens stored in httpOnly cookies" is better than "add auth"
2. **Mention your stack** — "I'm using Next.js 14, Prisma, and PostgreSQL" helps agents write relevant code
3. **Set the right models** — Use the Model Configuration (CPU icon) to assign stronger models to agents where quality matters most (e.g., Coder)
4. **Use custom agents** — Create specialized agents for your domain (e.g., "Laravel Expert", "AWS Architect", "UI/UX Reviewer")
5. **Check the Activity feed** — The best insights often come from agents reviewing each other's work, not the primary task output
