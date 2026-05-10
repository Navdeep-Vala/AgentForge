export type SessionStatus = 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'failed' | 'cancelled' | 'needs_approval' | 'waiting_for_predecessor';
export type CommentType = 'insight' | 'review' | 'refute' | 'praise' | 'question' | 'clarification';

export const SUB_AGENT_TYPES = ['file_checker', 'error_checker', 'test_runner', 'code_reviewer', 'security_auditor'] as const;
export type SubAgentType = (typeof SUB_AGENT_TYPES)[number];

export const SPECIALIZED_AGENT_TYPES = ['analyzer', 'designer', 'data_engineer', 'devops', 'security_expert', 'performance_engineer'] as const;
export type SpecializedAgentType = (typeof SPECIALIZED_AGENT_TYPES)[number];

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

export interface Session {
  id: string;
  project_id: string | null;
  goal: string;
  status: SessionStatus;
  workspace_dir: string | null;
  final_report: string | null;
  total_tokens_used: number;
  estimated_cost_usd: number;
  heartbeat_interval_minutes: number;
  created_at: number;
  updated_at: number;
}

export interface AgentStep {
  id: string;
  task_id: string;
  step_number: number;
  tool_name: string;
  tool_args: any;
  tool_output: string | null;
  tokens_used: number;
  duration_ms: number;
  created_at: number;
}

export interface FileChange {
  id: string;
  session_id: string;
  task_id: string;
  file_path: string;
  change_type: 'created' | 'modified' | 'deleted';
  diff_content: string | null;
  created_at: number;
}

export interface Task {
  id: string;
  session_id: string;
  agent_type: string;
  agent_name: string;
  title: string;
  description: string;
  status: TaskStatus;
  output: string | null;
  thought: string | null;
  tokens_used: number;
  model_used: string | null;
  spawned_by_agent: string | null;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
  parent_task_id: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  session_id: string;
  agent_type: string;
  agent_name: string;
  content: string;
  comment_type: CommentType;
  tokens_used: number;
  created_at: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  agent_type: string;
  agent_name: string;
  content: string;
  spawns_task: boolean;
  spawned_task_id: string | null;
  created_at: number;
}

export interface ModelConfig {
  id: string;
  provider: string;
  api_key_encrypted: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface CustomAgent {
  id: string;
  name: string;
  type: string;
  description: string;
  system_prompt: string;
  model: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: number;
}

export interface ManagerTaskPlan {
  thought: string;
  tasks: Array<{
    agent_type: string;
    title: string;
    description: string;
  }>;
}

// ─── Sub-Agent Delegation ────────────────────────────────────────────────────

export interface SubAgent {
  id: string;
  task_id: string;
  session_id: string;
  sub_agent_type: SubAgentType;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string | null;
  thought?: string | null;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
}

// ─── Clarification Requests ──────────────────────────────────────────────────

export interface ClarificationRequest {
  id: string;
  session_id: string;
  task_id: string;
  agent_type: string;
  agent_name: string;
  question: string;
  context: string | null;
  options: string[] | null;
  answer?: string | null;
  status: 'pending' | 'answered' | 'expired';
  created_at: number;
  answered_at: number | null;
}

export interface ClarificationResponse {
  clarification_id: string;
  answer: string;
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export interface SSETaskCreatedEvent {
  type: 'task_created';
  task: {
    id: string;
    status: TaskStatus;
    agent_type: string;
    agent_name: string;
    title: string;
    description: string;
    spawned_by_agent: string | null;
    created_at: number;
  };
}

export interface SSETaskClaimedEvent {
  type: 'task_claimed';
  taskId: string;
  agentName: string;
  agentType: string;
  started_at: number;
}

export interface SSETaskCompleteEvent {
  type: 'task_complete';
  task: {
    id: string;
    status: TaskStatus;
    output: string | null;
    thought: string | null;
    tokens_used: number;
    model_used: string | null;
    completed_at: number;
  };
}

export interface SSETaskFailedEvent {
  type: 'task_failed';
  taskId: string;
  error: string;
}

export interface SSETaskCommentEvent {
  type: 'task_comment';
  taskId: string;
  comment: TaskComment;
}

export interface SSEChatMessageEvent {
  type: 'chat_message';
  message: ChatMessage;
}

export interface SSETaskSpawnedEvent {
  type: 'task_spawned';
  newTask: Pick<Task, 'id' | 'title' | 'agent_type' | 'agent_name' | 'spawned_by_agent'>;
  spawnedByAgent: string;
  fromChatMessageId: string;
}

export interface SSESessionCompleteEvent {
  type: 'session_complete';
  final_report: string;
  total_tokens: number;
  cost_usd: number;
}

export interface SSEHeartbeatTickEvent {
  type: 'heartbeat_tick';
  agentType: string;
  tasksScanned: number;
}

export interface SSEErrorEvent {
  type: 'error';
  taskId: string;
  message: string;
}

export interface SSEConnectedEvent {
  type: 'connected';
}

export interface AgentOverride {
  modelId?: string;
  name?: string;
}

export interface SSESessionStatusChangedEvent {
  type: 'session_status_changed';
  status: SessionStatus;
}

export interface SSEAgentThinkingEvent {
  type: 'agent_thinking';
  agentType: string;
  agentName: string;
  message: string;
}

export interface SSEManagerWorkingEvent {
  type: 'manager_working';
  message: string;
}

export interface SSEAgentToolUseEvent {
  type: 'agent_tool_use';
  taskId: string;
  agentType: string;
  toolName: string;
  toolArgs: any;
  iteration: number;
}

export interface SSEAgentToolResultEvent {
  type: 'agent_tool_result';
  taskId: string;
  agentType: string;
  toolName: string;
  output: string;
  success: boolean;
}

export interface SSEFileChangedEvent {
  type: 'file_changed';
  sessionId: string;
  taskId: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
}

export interface SSENeedsApprovalEvent {
  type: 'needs_approval';
  taskId: string;
  agentType: string;
  agentName: string;
  title: string;
  output: string;
  notify?: boolean;
}

export interface SSESubAgentEvent {
  type: 'sub_agent_spawned' | 'sub_agent_complete' | 'sub_agent_failed';
  taskId: string;
  subAgentId: string;
  subAgentType: string;
  title: string;
  output?: string;
  thought?: string;
}

export interface SSEClarificationRequestEvent {
  type: 'clarification_request';
  requestId: string;
  taskId: string;
  agentType: string;
  agentName: string;
  question: string;
  context: string | null;
  options: string[] | null;
  notify?: boolean;
}

export interface SSEClarificationResponseEvent {
  type: 'clarification_response';
  requestId: string;
  taskId: string;
  response: string;
}

export interface SSEApprovalResponseEvent {
  type: 'approval_response';
  taskId: string;
  approved: boolean;
  feedback: string;
}

export interface SSEFileChangedEvent {
  type: 'file_changed';
  sessionId: string;
  taskId: string;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
}

export interface SSESpecializedAgentSpawnedEvent {
  type: 'specialized_agent_spawned';
  taskId: string;
  agentType: string;
  agentName: string;
  description: string;
}

export type SSEEvent =
  | SSETaskCreatedEvent
  | SSETaskClaimedEvent
  | SSETaskCompleteEvent
  | SSETaskFailedEvent
  | SSETaskCommentEvent
  | SSEChatMessageEvent
  | SSETaskSpawnedEvent
  | SSESessionCompleteEvent
  | SSEHeartbeatTickEvent
  | SSESessionStatusChangedEvent
  | SSEAgentThinkingEvent
  | SSEErrorEvent
  | SSEConnectedEvent
  | SSEManagerWorkingEvent
  | SSEAgentToolUseEvent
  | SSEAgentToolResultEvent
  | SSEFileChangedEvent
  | SSENeedsApprovalEvent
  | SSESubAgentEvent
  | SSEClarificationRequestEvent
  | SSEClarificationResponseEvent
  | SSEApprovalResponseEvent
  | SSESpecializedAgentSpawnedEvent;

// ─── Model / OpenRouter ───────────────────────────────────────────────────────

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface OpenRouterCallResult {
  content: string | null;
  tokensUsed: number;
  toolCalls?: any[];
}

export interface BuiltInAgentDefinition {
  type: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  color: string;
  icon: string;
}

export interface FreeModel {
  id: string;
  name: string;
  provider: string;
  best_for: string;
}

