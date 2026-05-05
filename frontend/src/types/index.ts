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
  tasks: Task[];
}

export interface SessionSummary {
  id: string;
  goal: string;
  status: SessionStatus;
  taskCount: number;
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

export interface AgentDefinition {
  id?: string;
  type: string;
  name: string;
  description: string;
  system_prompt?: string;
  model: string;
  color: string;
  icon: string;
  is_active?: boolean;
  is_builtin?: boolean;
  created_at?: number;
}

// ─── SSE Message types ────────────────────────────────────────────────────────

export type SSEMessage =
  | { type: 'connected' }
  | {
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
  | {
      type: 'task_claimed';
      taskId: string;
      agentName: string;
      agentType: string;
      started_at: number;
    }
  | {
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
  | { type: 'task_failed'; taskId: string; error: string }
  | { type: 'task_comment'; taskId: string; comment: TaskComment }
  | { type: 'chat_message'; message: ChatMessage }
  | {
      type: 'task_spawned';
      newTask: { id: string; title: string; agent_type: string; agent_name: string; spawned_by_agent: string | null };
      spawnedByAgent: string;
      fromChatMessageId: string;
    }
  | { type: 'session_complete'; final_report: string; total_tokens: number; cost_usd: number }
  | { type: 'heartbeat_tick'; agentType: string; tasksScanned: number }
  | { type: 'session_status_changed'; status: SessionStatus }
  | { type: 'agent_thinking'; agentType: string; agentName: string; message: string }
  | { type: 'manager_working'; message: string }
  | { type: 'error'; taskId: string; message: string };

// ─── Model selector ───────────────────────────────────────────────────────────

export const FREE_MODELS = [
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (planning, reasoning)' },
  { value: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder 480B (best for code)' },
  { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (research, general)' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron Super 120B (analysis, R&D)' },
  { value: 'nousresearch/hermes-3-llama-3.1-405b:free', label: 'Hermes 3 405B (complex reasoning)' },
  { value: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (lightweight fallback)' },
] as const;
