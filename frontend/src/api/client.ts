import axios from 'axios';
import { Session, SessionSummary, AgentDefinition, TaskComment } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export async function createSession(
  goal: string, 
  agentOverrides?: Record<string, { modelId?: string; name?: string }>,
  projectId?: string,
  workspaceDir?: string
): Promise<{ sessionId: string; status: string }> {
  const res = await api.post<{ sessionId: string; status: string }>('/sessions', { 
    goal, 
    agentOverrides,
    projectId,
    workspaceDir
  });
  return res.data;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await api.get<{ sessions: SessionSummary[] }>('/sessions');
  return res.data.sessions;
}

export async function getSession(id: string): Promise<{ session: Session; comments: TaskComment[]; chatMessages: any[] }> {
  const res = await api.get<{ session: Session; comments: TaskComment[]; chatMessages: any[] }>(`/sessions/${id}`);
  return res.data;
}

export async function cancelSession(id: string): Promise<void> {
  await api.delete(`/sessions/${id}/cancel`);
}

export async function listAgents(): Promise<AgentDefinition[]> {
  const res = await api.get<{ agents: AgentDefinition[] }>('/agents');
  return res.data.agents;
}

export async function createAgent(data: {
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  color: string;
  icon: string;
}): Promise<AgentDefinition> {
  const res = await api.post<{ agent: AgentDefinition }>('/agents', data);
  return res.data.agent;
}

export async function updateAgent(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    system_prompt: string;
    model: string;
    color: string;
    icon: string;
    is_active: boolean;
  }>
): Promise<AgentDefinition> {
  const res = await api.put<{ agent: AgentDefinition }>(`/agents/${id}`, data);
  return res.data.agent;
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`);
}

export async function getTask(taskId: string): Promise<{ task: unknown; comments: TaskComment[] }> {
  const res = await api.get<{ task: unknown; comments: TaskComment[] }>(`/tasks/${taskId}`);
  return res.data;
}

export interface FreeModel { id: string; name: string; provider: string; best_for: string }
export interface ByokModel { id: string; name: string; provider: string; configured: boolean }

export async function listModels(): Promise<{ free: FreeModel[]; byok: ByokModel[] }> {
  const res = await api.get<{ free: FreeModel[]; byok: ByokModel[] }>('/models');
  return res.data;
}

export async function saveApiKey(provider: string, api_key: string): Promise<{ masked: string }> {
  const res = await api.post<{ masked: string }>('/models/keys', { provider, api_key });
  return res.data;
}

export async function testApiKey(provider: string, api_key: string): Promise<{ valid: boolean }> {
  const res = await api.post<{ valid: boolean }>('/models/keys/test', { provider, api_key });
  return res.data;
}

export async function deleteApiKey(provider: string): Promise<void> {
  await api.delete(`/models/keys/${provider}`);
}

export function getSseUrl(sessionId: string): string {
  return `${BASE_URL}/api/sse/${sessionId}`;
}
