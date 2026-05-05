export type SessionStatus = 'pending' | 'running' | 'completed' | 'cancelled';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'failed' | 'cancelled';
export type CommentType = 'insight' | 'review' | 'refute' | 'praise' | 'question';

export interface Session {
  id: string;
  goal: string;
  status: SessionStatus;
  final_report: string | null;
  total_tokens_used: number;
  estimated_cost_usd: number;
  heartbeat_interval_minutes: number;
  created_at: number;
  updated_at: number;
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
  tokens_used: number;
  model_used: string | null;
  spawned_by_agent: string | null;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
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
  tasks: Array<{
    agent_type: string;
    title: string;
    description: string;
  }>;
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export interface SSETaskCreatedEvent {
  type: 'task_created';
  task: {
    id: string;
    status: 'todo';
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
    status: 'done';
    output: string | null;
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
  | SSEManagerWorkingEvent;

// ─── Model / OpenRouter ───────────────────────────────────────────────────────

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCallResult {
  content: string;
  tokensUsed: number;
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
