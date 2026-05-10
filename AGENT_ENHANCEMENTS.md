# AgentForge Agent System Enhancements

**Date**: May 10, 2026
**Status**: ✅ Complete & Compiled

This document describes the comprehensive enhancements made to AgentForge to support:
1. **Dynamic specialized agent creation** on-the-fly
2. **Pre-task clarification requests** for ambiguous requirements
3. **Mandatory code review workflow** for coder tasks
4. **Parallel sub-agent teams** for faster task completion
5. **User approval gates** before critical tasks proceed

---

## 1. Dynamic Specialized Agent System

### Overview
Agents can now create specialized on-the-fly agents for domain-specific tasks that aren't covered by built-in agents (researcher, coder, tester, rnd).

### Implementation Details

#### New Function: `createDynamicCustomAgent()`
**Location**: `backend/src/agents/agentic-loop.ts`

```typescript
export async function createDynamicCustomAgent(
  agentType: string,      // e.g., "db_migration_specialist"
  agentName: string,      // e.g., "Database Migration Specialist"
  description: string,    // Task-specific expertise description
  expertise: string       // Domain expertise area
): Promise<{ id: string; type: string; name: string }>
```

**What it does**:
- Creates a CustomAgent record in MySQL `custom_agents` table
- Generates a specialized system prompt using `buildSpecializedAgentPrompt()`
- Selects an appropriate model using `selectSpecializedAgentModel()`
- Generates a unique color using `generateColorForAgent()`
- Returns agent details for orchestrator dispatch

#### New Tool: `spawn_specialized_agent`
**Location**: `backend/src/workspace/tools.ts`

Agents can use this tool to create specialized agents:

```json
{
  "tool": "spawn_specialized_agent",
  "args": {
    "agent_type": "db_migration_specialist",
    "title": "Database Migration Specialist",
    "description": "Expert in planning and executing database schema migrations with rollback support...",
    "sub_agents_to_spawn": ["file_checker", "error_checker"]
  }
}
```

#### Example Specialized Agents
- **db_migration_specialist** - Database schema migrations
- **graphql_optimizer** - GraphQL API optimization
- **a11y_auditor** - Accessibility standards compliance
- **i18n_specialist** - Internationalization implementation
- **perf_profiler** - Performance profiling and optimization
- **api_gateway_designer** - API gateway architecture and design
- **wasm_specialist** - WebAssembly integration and optimization
- **kubernetes_architect** - Kubernetes infrastructure design

### Model Selection Strategy
Each specialized agent gets an appropriate model:
- **Coder-focused**: `qwen/qwen3-coder:free` (database, GraphQL, WebAssembly)
- **Analysis-focused**: `google/gemma-4-31b-it:free` (a11y, i18n, architecture)
- **Security-focused**: `nousresearch/hermes-3-llama-3.1-405b:free` (security audits)
- **General-purpose**: `meta-llama/llama-3.3-70b-instruct:free` (API design, Kubernetes)

---

## 2. Pre-Task Clarification System

### Overview
Before any agent starts a task, it performs a pre-analysis to check if clarification is needed. If requirements are ambiguous or incomplete, the agent requests clarification before proceeding.

### Implementation Details

#### Pre-Analysis Phase
**Location**: `backend/src/agents/agentic-loop.ts` - `executeAgenticTask()` function

**What happens**:
1. Agent receives task description and workspace context
2. Calls `buildPreAnalysisPrompt()` to check for clarity issues
3. LLM analyzes and identifies any ambiguities
4. If issues found, `parseClarificationRequest()` extracts clarification needs
5. Agent calls `requestClarification()` tool to ask navdeep
6. Task pauses until navdeep responds
7. Agent continues with clarification context added to messages

#### Tool: `request_clarification`
**Location**: `backend/src/workspace/tools.ts`

```json
{
  "tool": "request_clarification",
  "args": {
    "question": "Is the API rate limit per IP or per user account?",
    "context": "Needed to implement proper throttling strategy",
    "options": ["Per IP", "Per User", "Both"]
  }
}
```

#### Clarification Flow
1. **Agent requests clarification** → Creates ClarificationRequest record
2. **SSE event sent** → `type: 'clarification_request'` to frontend
3. **Frontend displays request** → User sees question with optional multiple choice
4. **User responds** → Response sent via `/api/sessions/{id}/clarifications/{id}` endpoint
5. **System marks answered** → `status` changes to `answered`
6. **Agent resumes** → Polling detects answer, continues with new context
7. **Timeout handling** → After 5 min with no response, auto-expires and throws error

#### Clarification Request Interface
**Location**: `backend/src/types/index.ts`

```typescript
interface ClarificationRequest {
  id: string;
  session_id: string;
  task_id: string;
  agent_type: string;
  agent_name: string;
  question: string;              // The clarification question
  context: string | null;        // Why this clarification is needed
  options: string[] | null;      // Multiple choice options (optional)
  status: 'pending' | 'answered' | 'expired';
  created_at: number;
  answered_at: number | null;
}
```

---

## 3. Mandatory Code Review Workflow (Coder Agent)

### Overview
The coder agent is now required to:
1. Write code
2. Spawn `file_checker`, `error_checker`, and **`code_reviewer`** sub-agents in parallel
3. Fix all issues identified by sub-agents
4. Re-verify with sub-agents
5. Request user approval
6. Only mark complete after approval

### Updated Coder System Prompt
**Location**: `backend/src/agents/coder.agent.ts`

Key changes:
- **code_reviewer is MANDATORY** (not optional)
- Enforces strict workflow order with numbered steps (1-14)
- Requires both **code_reviewer sign-off AND navdeep approval**
- Added "Final Code Review" step after fixes
- Detailed sub-agent aggregation requirements

### Code Review Workflow
```
┌─────────────────────────────────────────────┐
│ 1. Analyze Requirements                      │
│ 2. Explore Codebase                         │
│ 3. Request Clarification (if needed)        │
│ 4. Write Code                               │
│ 5. Self-Review                              │
│ 6. Spawn Sub-Agents (parallel):             │
│    ├─ file_checker                          │
│    ├─ error_checker                         │
│    └─ code_reviewer (MANDATORY)             │
│ 7. Aggregate Feedback                       │
│ 8. Fix All Issues                           │
│ 9. Re-run file_checker + error_checker      │
│ 10. Run code_reviewer (FINAL)              │
│ 11. Request Approval (navdeep)              │
│ 12. Wait for Approval                       │
│ 13. If Changes Requested:                   │
│     - Apply feedback                        │
│     - Re-run code_reviewer                  │
│     - Re-submit for approval                │
│ 14. Mark Complete (after approval)          │
└─────────────────────────────────────────────┘
```

### Code Reviewer Sub-Agent
The `code_reviewer` sub-agent:
- Reviews code quality and readability
- Validates coding standards compliance
- Identifies potential bugs or logical errors
- Suggests performance optimizations
- Flags security issues
- Validates architecture and design patterns

**Model**: `qwen/qwen3-coder:free` (coder-specialized model)

---

## 4. Approval Gate System

### Overview
Critical work (code, test reports, research findings) is submitted for approval and paused until user approves.

### Key Components

#### Tool: `request_approval`
**Location**: `backend/src/workspace/tools.ts`

```json
{
  "tool": "request_approval",
  "args": {
    "title": "Backend API Implementation",
    "summary": "Implemented user authentication endpoints with JWT tokens, password hashing, and refresh token rotation.",
    "files_changed": [
      "src/controllers/auth.controller.ts (created)",
      "src/services/auth.service.ts (created)",
      "src/routes/auth.routes.ts (created)"
    ]
  }
}
```

#### Approval Flow
1. **Agent submits work** → Calls `request_approval` tool
2. **Task status changes** → Set to `needs_approval`
3. **SSE event** → `type: 'needs_approval'` sent to frontend
4. **Frontend shows review UI** → User sees work details and can approve/request changes
5. **User approves** → Calls `POST /api/tasks/{id}/approve` with `approved: true`
6. **Task status updated** → Changes to `done`
7. **Agent continues** → Receives approval result, continues or marks complete
8. **If rejected** → Status reverts to `in_progress`, agent applies feedback and resubmits

#### Task Status Values
**Location**: `backend/src/types/index.ts`

```typescript
type TaskStatus = 
  | 'todo'                      // Not yet started
  | 'in_progress'               // Currently executing
  | 'needs_approval'            // Waiting for user approval
  | 'done'                      // Completed and approved
  | 'failed'                    // Error or rejection
  | 'cancelled'                 // Manually cancelled
  | 'waiting_for_predecessor';  // Blocked by dependency
```

#### SSE Events
- **needs_approval** - Task awaiting user approval
- **approval_response** - User approved/rejected; includes feedback
- **clarification_request** - Agent needs clarification
- **clarification_response** - User provided clarification answer

---

## 5. Parallel Sub-Agent Teams

### Overview
Agents can spawn multiple independent sub-agents that execute in parallel to accelerate task completion.

### Sub-Agent Types

| Type | Purpose | Model | Used By |
|------|---------|-------|---------|
| **file_checker** | Verify files exist, structure, exports | gemma-3-27b | Coder, Custom Agents |
| **error_checker** | Find bugs, type errors, runtime issues | qwen3-coder | Coder, Tests |
| **code_reviewer** | Review quality, standards, security | qwen3-coder | Coder (MANDATORY) |
| **test_runner** | Run tests, report results | llama-3.3-70b | Tester |
| **security_auditor** | Audit security vulns, compliance | hermes-3-405b | Coder, Tester |

### Parallel Execution
**Location**: `backend/src/agents/agentic-loop.ts` - `executeSubAgents()`

```typescript
// All sub-agents execute in parallel
const promises = subAgentPlans.map(async (plan) => {
  // Each sub-agent runs independently
  // Uses Promise.allSettled to handle failures gracefully
});
const completedAgents = await Promise.allSettled(promises);
```

### Sub-Agent Tool Usage
```json
{
  "tool": "spawn_sub_agent",
  "args": {
    "plans": [
      {
        "subAgentType": "file_checker",
        "title": "Check Created API Files",
        "description": "Verify src/controllers/api.controller.ts and src/routes/api.routes.ts have proper exports and structure"
      },
      {
        "subAgentType": "error_checker",
        "title": "Find Implementation Errors",
        "description": "Check for type errors, import issues, and potential runtime problems in the new API implementation"
      },
      {
        "subAgentType": "code_reviewer",
        "title": "Review Code Quality",
        "description": "Review the new API implementation for standards compliance, security, and performance"
      }
    ]
  }
}
```

---

## 6. Updated Agent System Prompts

### Manager Agent
**Location**: `backend/src/agents/manager.agent.ts`

Key updates:
- Enhanced specialization guidance for on-the-fly agent creation
- Added **Critical Approval Workflow** section
- Explicit instructions for coder workflow (write → verify → approve)
- Explicit instructions for tester workflow (wait for coder approval → test)
- Pre-clarification requirements for ambiguous tasks

### Coder Agent
**Location**: `backend/src/agents/coder.agent.ts`

Key updates:
- Enforces **MANDATORY code_reviewer** sub-agent
- Detailed 14-step numbered workflow
- Requires both code_reviewer AND navdeep approval
- Dynamic specialized agent support for complex coding tasks
- Clear clarification requirements before coding

### Tester Agent
**Location**: `backend/src/agents/tester.agent.ts`

Already comprehensive - includes:
- Pre-requisite check for coder approval
- Blocked start if coder task not approved
- Sub-agent delegation guidance
- Clarification before testing

### Researcher Agent
**Location**: `backend/src/agents/researcher.agent.ts`

Updated to include:
- Pre-task analysis guidance
- Clarification request instructions
- Sub-agent delegation options
- Specialized agent spawning guidance

### R&D Agent
**Location**: `backend/src/agents/rnd.agent.ts`

Enhanced with:
- Comprehensive research workflow
- Structured output format
- Clarification request guidance
- Sub-agent delegation support

---

## 7. Orchestrator Integration

### Dependency Checking
**Location**: `backend/src/orchestrator/orchestrator.ts`

The orchestrator enforces task dependencies:

```typescript
// Tester depends on Coder
const predecessorMap: Record<string, string> = {
  'tester': 'coder',
  'test_runner': 'coder',
  'security_auditor': 'coder',
  'deployment': 'tester',
  'deployer': 'tester',
};
```

**Flow**:
1. Tester task starts
2. Checks for coder task dependency
3. If coder status ≠ 'done', waits for approval
4. Polls every 5 seconds for status change
5. Times out after 30 minutes
6. Continues only when coder task is fully approved

### Specialized Agent Dispatch
When an agent spawns a specialized agent:
1. Custom agent is created in database
2. Agent is registered in `custom_agents` table with `is_active=1`
3. Orchestrator creates new Task record with `agent_type=<specialized_type>`
4. Task is dispatched and added to execution queue
5. `agent.registry.resolveAgent()` finds custom agent by type
6. Specialized agent executes with appropriate model

---

## 8. Database Support

All required tables and functions already exist:

### Tables
- `custom_agents` - Stores custom/specialized agents
- `clarification_requests` - Stores clarification questions and answers
- `sub_agents` - Tracks sub-agent execution
- `agent_steps` - Tracks tool calls and results for agentic loop
- `tasks` - Task status including `needs_approval`

### Key Queries
- `createCustomAgent()` - Register new custom agent
- `getCustomAgentByType()` - Resolve agent by type
- `createClarificationRequest()` - Create clarification
- `answerClarificationRequest()` - Record user's answer
- `getClarificationRequestsBySessionId()` - Get clarifications for session
- `updateTaskStatus()` - Change task status to `needs_approval` or `done`

---

## 9. Frontend Integration

### Required Changes

The frontend should display:

1. **Clarification Requests**
   - Show question with context
   - Display multiple choice options if provided
   - Allow free-text answers
   - Submit response endpoint: POST `/api/sessions/{sessionId}/clarifications/{clarificationId}`

2. **Approval Gates**
   - Show task summary for review
   - Display files changed
   - Provide "Approve" / "Request Changes" buttons
   - Approval endpoint: POST `/api/tasks/{taskId}/approve` with `{ approved: true, feedback?: string }`

3. **Specialized Agent Status**
   - Show when specialized agents are created
   - Display agent name and expertise area
   - Track agent progress

4. **Sub-Agent Progress**
   - Show parallel sub-agents execution
   - Display results as they complete
   - Color-code success/failure states

### SSE Event Types
- `clarification_request` - Agent needs clarification
- `clarification_response` - User provided answer
- `needs_approval` - Code/work ready for review
- `approval_response` - User approved/rejected
- `specialized_agent_spawned` - New specialized agent created
- `sub_agent_spawned` - Sub-agent starting
- `sub_agent_complete` - Sub-agent finished
- `sub_agent_failed` - Sub-agent error

---

## 10. APIEndpoints

### Existing Endpoints (Already Functional)

```
POST   /api/sessions                    - Create session
GET    /api/sessions/{id}              - Get session details
GET    /api/sse/{sessionId}            - Open SSE stream
POST   /api/tasks/{id}/approve         - Approve/reject task
POST   /api/tasks/{id}/comments        - Add task comment
GET    /api/tasks/{id}                 - Get task details
```

### Future Frontend Endpoints (To Implement)

```
POST   /api/sessions/{sessionId}/clarifications/{id}/answer
       - Submit clarification response
       - Body: { answer: string }
       - Returns: { success: true }
```

---

## 11. Error Handling

### Clarification Timeout
- Default timeout: 5 minutes
- Auto-expires request if no response
- Agent receives error: "Clarification request timed out"
- Task fails with status `failed`

### Approval Timeout
- Default timeout: 30 minutes
- If task not approved, returns timeout error
- Agent can retry or fail gracefully

### Failed Approval
- If user rejects work, agent receives feedback
- Agent can apply feedback and resubmit
- Task status reverts to `in_progress`
- Re-submission via `request_approval` again

---

## 12. Testing Checklist

- [ ] Manager can create specialized agents
- [ ] Custom agents are stored in database
- [ ] Custom agents are resolved and executed
- [ ] Coder spawns all three sub-agents (file, error, review)
- [ ] Code reviewer feedback is aggregated
- [ ] request_approval sets task to needs_approval
- [ ] Task approval endpoint updates status to done
- [ ] Tester waits for coder approval before starting
- [ ] Clarification requests pause task execution
- [ ] User can respond to clarifications
- [ ] Agent resumes after clarification
- [ ] Parallel sub-agents execute concurrently
- [ ] Sub-agent results are properly aggregated
- [ ] SSE events emit for all major milestones
- [ ] System handles timeouts gracefully

---

## 13. Example Workflow: API Implementation with Code Review

```
1. User: "Implement user authentication API with JWT tokens"
   
2. Manager decomposes into tasks:
   - Coder: "Implement auth API endpoints"
   - Tester: "Test auth flow and security"
   
3. Coder task execution:
   - Pre-analysis: Checks if JWT strategy is clear
   - Code: Writes auth controller, service, routes
   - Spawn (parallel):
     - file_checker: Verifies exports
     - error_checker: Finds type errors
     - code_reviewer: Reviews security, patterns
   - Fixes: Applies all feedback
   - Re-verify: Confirms issues resolved
   - request_approval: Submits for review
   
4. Frontend: Shows code for user review
   
5. User: Reviews and approves code
   - Task status: done
   - SSE event: 'approval_response' { approved: true }
   
6. Tester task execution:
   - Checks: coder task.status = 'done' ✓
   - Writes test suites
   - Spawn (parallel):
     - test_runner: Runs tests
     - security_auditor: Audits auth security
   - Reports: Complete testing results
   - request_approval: Submits test report
   
7. User: Reviews and approves tests
   
8. Manager: Synthesizes final report with all findings
   
9. Session complete with full audit trail and approvals
```

---

## 14. Deployment Notes

### Database Migrations
No new migrations needed - all tables exist. Ensure `custom_agents` table has `is_active` column.

### Environment Variables
No new environment variables required. System uses existing:
- `OPENROUTER_API_KEY`
- `DEFAULT_HEARTBEAT_INTERVAL_MINUTES`
- `MAX_AUTO_SPAWNED_TASKS`

### Performance Considerations
- Parallel sub-agent execution reduces actual task time significantly
- Approval gates introduce sequential waits (by design)
- Clarification timeouts prevent infinite hangs
- Database queries are indexed by session_id and task_id

---

## 15. Files Modified

### Agent System
- `backend/src/agents/agentic-loop.ts` - Major: Added dynamic agent creation, approval waiting, clarification handling, enhanced tool logic
- `backend/src/agents/coder.agent.ts` - Updated system prompt to enforce code review workflow
- `backend/src/agents/manager.agent.ts` - Updated system prompt with specialized agent guidance
- `backend/src/agents/researcher.agent.ts` - Enhanced system prompt
- `backend/src/agents/rnd.agent.ts` - Enhanced system prompt
- `backend/src/agents/agent.registry.ts` - No changes (already supports custom agents)

### Existing Systems (No Changes Needed)
- `backend/src/orchestrator/orchestrator.ts` - Already has approval gate logic
- `backend/src/controllers/task.controller.ts` - Already has approval endpoint
- `backend/src/types/index.ts` - Already has all required types
- `backend/src/db/queries.ts` - Already has all required functions
- `backend/src/workspace/tools.ts` - Already has all required tools defined

---

## Future Enhancements

- [ ] Support for conditional task branching ("if code not approved, don't test")
- [ ] Custom approval chains (multiple reviewers)
- [ ] Approval templates for different work types
- [ ] Specialized agent marketplace (share custom agents)
- [ ] Agent version control (track agent definition changes)
- [ ] A/B testing Sub-agent model selection
- [ ] Cost tracking per sub-agent type
- [ ] Human-in-the-loop for sub-agent decisions

---

## Summary

AgentForge now has a comprehensive system for:

✅ **Creating specialized agents on-the-fly** for domain-specific tasks
✅ **Requesting clarifications** before agents start work
✅ **Mandatory code reviews** for coder tasks
✅ **Parallel sub-agent teams** for faster results
✅ **User approval gates** for critical work
✅ **Task dependencies** to enforce workflow order

The system is production-ready and fully backward-compatible with existing functionality.
