import { RowDataPacket } from 'mysql2/promise';
import { getPool } from './database';
import {
  Session,
  Task,
  TaskComment,
  ChatMessage,
  ModelConfig,
  CustomAgent,
  SessionStatus,
  TaskStatus,
  Project,
  AgentStep,
  FileChange,
} from '../types';

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(project: Project): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO projects (id, name, description, repo_url, repo_context, workspace_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [project.id, project.name, project.description, project.repo_url, project.repo_context, project.workspace_path, project.created_at, project.updated_at]
  );
}

export async function getProjectById(id: string): Promise<Project | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM projects WHERE id = ?', [id]);
  return rows.length > 0 ? (rows[0] as Project) : null;
}

export async function getAllProjects(): Promise<Project[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM projects ORDER BY updated_at DESC');
  return rows as Project[];
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  const pool = getPool();
  const fields = Object.keys(updates)
    .filter(k => k !== 'id')
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(updates).filter((_, i) => Object.keys(updates)[i] !== 'id');
  values.push(id);
  await pool.execute(`UPDATE projects SET ${fields} WHERE id = ?`, values);
}

export async function deleteProject(id: string): Promise<void> {
  const pool = getPool();
  await pool.execute('DELETE FROM projects WHERE id = ?', [id]);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession(session: Session): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO sessions
       (id, project_id, goal, status, workspace_dir, final_report, total_tokens_used, estimated_cost_usd,
        heartbeat_interval_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.project_id,
      session.goal,
      session.status,
      session.workspace_dir,
      session.final_report,
      session.total_tokens_used,
      session.estimated_cost_usd,
      session.heartbeat_interval_minutes,
      session.created_at,
      session.updated_at,
    ]
  );
}

export async function getSessionById(id: string): Promise<Session | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM sessions WHERE id = ?', [id]);
  return rows.length > 0 ? (rows[0] as Session) : null;
}

export async function getAllSessions(projectId?: string): Promise<Array<Session & { taskCount: number }>> {
  const pool = getPool();
  let query = `
    SELECT s.*, COUNT(t.id) AS taskCount
    FROM sessions s
    LEFT JOIN tasks t ON t.session_id = s.id
  `;
  const params: any[] = [];

  if (projectId) {
    query += ' WHERE s.project_id = ?';
    params.push(projectId);
  }

  query += `
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return rows as Array<Session & { taskCount: number }>;
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
  updatedAt: number
): Promise<void> {
  const pool = getPool();
  await pool.execute('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    updatedAt,
    id,
  ]);
}

export async function updateSessionFinalReport(
  id: string,
  finalReport: string,
  status: SessionStatus,
  totalTokensUsed: number,
  estimatedCostUsd: number,
  updatedAt: number
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `UPDATE sessions
     SET final_report = ?, status = ?, total_tokens_used = ?, estimated_cost_usd = ?, updated_at = ?
     WHERE id = ?`,
    [finalReport, status, totalTokensUsed, estimatedCostUsd, updatedAt, id]
  );
}

export async function incrementSessionTokens(
  id: string,
  tokens: number,
  updatedAt: number
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'UPDATE sessions SET total_tokens_used = total_tokens_used + ?, updated_at = ? WHERE id = ?',
    [tokens, updatedAt, id]
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(task: Task): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO tasks
       (id, session_id, agent_type, agent_name, title, description, status,
        output, tokens_used, model_used, spawned_by_agent, started_at, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.session_id,
      task.agent_type,
      task.agent_name,
      task.title,
      task.description,
      task.status,
      task.output,
      task.tokens_used,
      task.model_used,
      task.spawned_by_agent,
      task.started_at,
      task.completed_at,
      task.created_at,
    ]
  );
}

export async function getTaskById(id: string): Promise<Task | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM tasks WHERE id = ?', [id]);
  return rows.length > 0 ? (rows[0] as Task) : null;
}

export async function getTasksBySessionId(sessionId: string): Promise<Task[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
  return rows as Task[];
}

export async function getRecentDoneTasksBySession(
  sessionId: string,
  sinceMs: number
): Promise<Task[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM tasks
     WHERE session_id = ? AND status = 'done' AND completed_at >= ?
     ORDER BY completed_at DESC`,
    [sessionId, sinceMs]
  );
  return rows as Task[];
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  startedAt?: number | null
): Promise<void> {
  const pool = getPool();
  await pool.execute('UPDATE tasks SET status = ?, started_at = ? WHERE id = ?', [
    status,
    startedAt ?? null,
    id,
  ]);
}

export async function updateTaskComplete(
  id: string,
  status: TaskStatus,
  output: string | null,
  tokensUsed: number,
  modelUsed: string | null,
  completedAt: number
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'UPDATE tasks SET status = ?, output = ?, tokens_used = ?, model_used = ?, completed_at = ? WHERE id = ?',
    [status, output, tokensUsed, modelUsed, completedAt, id]
  );
}

export async function cancelSessionTasks(sessionId: string): Promise<void> {
  const pool = getPool();
  await pool.execute(
    "UPDATE tasks SET status = 'cancelled' WHERE session_id = ? AND status IN ('todo', 'in_progress')",
    [sessionId]
  );
}

export async function getAutoSpawnedTaskCount(sessionId: string): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM tasks WHERE session_id = ? AND spawned_by_agent IS NOT NULL',
    [sessionId]
  );
  return (rows[0] as { cnt: number }).cnt;
}

// ─── Task Comments ─────────────────────────────────────────────────────────────

export async function createTaskComment(comment: TaskComment): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO task_comments
       (id, task_id, session_id, agent_type, agent_name, content, comment_type, tokens_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      comment.id,
      comment.task_id,
      comment.session_id,
      comment.agent_type,
      comment.agent_name,
      comment.content,
      comment.comment_type,
      comment.tokens_used,
      comment.created_at,
    ]
  );
}

export async function getCommentsByTaskId(taskId: string): Promise<TaskComment[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC',
    [taskId]
  );
  return rows as TaskComment[];
}

export async function getCommentsBySessionId(sessionId: string): Promise<TaskComment[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM task_comments WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
  return rows as TaskComment[];
}

// ─── Chat Messages ─────────────────────────────────────────────────────────────

export async function createChatMessage(message: ChatMessage): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO chat_messages
       (id, session_id, agent_type, agent_name, content, spawns_task, spawned_task_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.session_id,
      message.agent_type,
      message.agent_name,
      message.content,
      message.spawns_task ? 1 : 0,
      message.spawned_task_id,
      message.created_at,
    ]
  );
}

export async function getChatMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
  return (rows as Array<Omit<ChatMessage, 'spawns_task'> & { spawns_task: number }>).map((r) => ({
    ...r,
    spawns_task: r.spawns_task === 1,
  }));
}

export async function getRecentChatMessages(
  sessionId: string,
  sinceMs: number
): Promise<ChatMessage[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM chat_messages WHERE session_id = ? AND created_at >= ? ORDER BY created_at ASC',
    [sessionId, sinceMs]
  );
  return (rows as Array<Omit<ChatMessage, 'spawns_task'> & { spawns_task: number }>).map((r) => ({
    ...r,
    spawns_task: r.spawns_task === 1,
  }));
}

export async function updateChatMessageSpawnedTask(
  id: string,
  spawnedTaskId: string
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'UPDATE chat_messages SET spawns_task = 1, spawned_task_id = ? WHERE id = ?',
    [spawnedTaskId, id]
  );
}

// ─── Model Configs ─────────────────────────────────────────────────────────────

export async function upsertModelConfig(
  id: string,
  provider: string,
  encryptedKey: string
): Promise<void> {
  const pool = getPool();
  const now = Date.now();
  await pool.execute(
    `INSERT INTO model_configs (id, provider, api_key_encrypted, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE api_key_encrypted = ?, is_active = 1, updated_at = ?`,
    [id, provider, encryptedKey, now, now, encryptedKey, now]
  );
}

export async function getModelConfig(provider: string): Promise<ModelConfig | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM model_configs WHERE provider = ? AND is_active = 1',
    [provider]
  );
  if (rows.length === 0) return null;
  const r = rows[0] as Omit<ModelConfig, 'is_active'> & { is_active: number };
  return { ...r, is_active: r.is_active === 1 };
}

export async function getAllModelConfigs(): Promise<ModelConfig[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM model_configs ORDER BY provider ASC');
  return (rows as Array<Omit<ModelConfig, 'is_active'> & { is_active: number }>).map((r) => ({
    ...r,
    is_active: r.is_active === 1,
  }));
}

export async function deleteModelConfig(provider: string): Promise<void> {
  const pool = getPool();
  await pool.execute('DELETE FROM model_configs WHERE provider = ?', [provider]);
}

// ─── Custom Agents ────────────────────────────────────────────────────────────

export async function createCustomAgent(agent: CustomAgent): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO custom_agents (id, name, type, description, system_prompt, model, color, icon, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agent.id,
      agent.name,
      agent.type,
      agent.description,
      agent.system_prompt,
      agent.model,
      agent.color,
      agent.icon,
      agent.is_active ? 1 : 0,
      agent.created_at,
    ]
  );
}

export async function getAllCustomAgents(): Promise<CustomAgent[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM custom_agents ORDER BY created_at DESC'
  );
  return (rows as Array<Omit<CustomAgent, 'is_active'> & { is_active: number }>).map((r) => ({
    ...r,
    is_active: r.is_active === 1,
  }));
}

export async function getActiveCustomAgents(): Promise<CustomAgent[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM custom_agents WHERE is_active = 1 ORDER BY created_at DESC'
  );
  return (rows as Array<Omit<CustomAgent, 'is_active'> & { is_active: number }>).map((r) => ({
    ...r,
    is_active: r.is_active === 1,
  }));
}

export async function getCustomAgentById(id: string): Promise<CustomAgent | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM custom_agents WHERE id = ?',
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0] as Omit<CustomAgent, 'is_active'> & { is_active: number };
  return { ...r, is_active: r.is_active === 1 };
}

export async function getCustomAgentByType(type: string): Promise<CustomAgent | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM custom_agents WHERE type = ?',
    [type]
  );
  if (rows.length === 0) return null;
  const r = rows[0] as Omit<CustomAgent, 'is_active'> & { is_active: number };
  return { ...r, is_active: r.is_active === 1 };
}

export async function updateCustomAgent(
  id: string,
  updates: Partial<Omit<CustomAgent, 'id' | 'created_at'>>
): Promise<void> {
  const pool = getPool();
  const fields = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(updates).map((v) =>
    typeof v === 'boolean' ? (v ? 1 : 0) : v
  );
  values.push(id);
  await pool.execute(`UPDATE custom_agents SET ${fields} WHERE id = ?`, values);
}

export async function deleteCustomAgent(id: string): Promise<void> {
  const pool = getPool();
  await pool.execute('DELETE FROM custom_agents WHERE id = ?', [id]);
}
// ─── Agent Steps ──────────────────────────────────────────────────────────────

export async function createAgentStep(step: AgentStep): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO agent_steps (id, task_id, step_number, tool_name, tool_args, tool_output, tokens_used, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      step.id,
      step.task_id,
      step.step_number,
      step.tool_name,
      JSON.stringify(step.tool_args),
      step.tool_output,
      step.tokens_used,
      step.duration_ms,
      step.created_at,
    ]
  );
}

export async function getStepsByTaskId(taskId: string): Promise<AgentStep[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM agent_steps WHERE task_id = ? ORDER BY step_number ASC',
    [taskId]
  );
  return rows as AgentStep[];
}

// ─── File Changes ─────────────────────────────────────────────────────────────

export async function createFileChange(change: FileChange): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO file_changes (id, session_id, task_id, file_path, change_type, diff_content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [change.id, change.session_id, change.task_id, change.file_path, change.change_type, change.diff_content, change.created_at]
  );
}

export async function getFileChangesBySessionId(sessionId: string): Promise<FileChange[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM file_changes WHERE session_id = ? ORDER BY created_at DESC',
    [sessionId]
  );
  return rows as FileChange[];
}

export async function getFileChangesByTaskId(taskId: string): Promise<FileChange[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM file_changes WHERE task_id = ? ORDER BY created_at DESC',
    [taskId]
  );
  return rows as FileChange[];
}
