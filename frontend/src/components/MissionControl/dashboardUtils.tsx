import {
  Bot,
  Code2,
  Crown,
  FlaskConical,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { AgentDefinition, ChatMessage, Session, Task, TaskComment, SubAgent } from '../../types';

export const USER_HANDLE = 'navdeep';

export interface AgentCatalogItem {
  type: string;
  name: string;
  role: string;
  shortRole: string;
  badge: string;
  color: string;
  icon: LucideIcon;
  about: string;
  skills: string[];
  isManager?: boolean;
}

const DEFAULT_AGENT_META: Record<string, Omit<AgentCatalogItem, 'type' | 'name' | 'role'>> = {
  manager: {
    shortRole: 'Squad Lead',
    badge: 'LEAD',
    color: '#d8892d',
    icon: Crown,
    about:
      'Chief orchestrator of the squad. Keeps work focused, routes effort only to the specialists that are needed, and escalates for review when human input matters.',
    skills: ['coordination', 'quality-control', 'triage', 'handoffs'],
    isManager: true,
  },
  researcher: {
    shortRole: 'Research Specialist',
    badge: 'SPC',
    color: '#6e9aeb',
    icon: Search,
    about:
      'Finds the right patterns, APIs, constraints, and implementation options so the rest of the team can move with confidence.',
    skills: ['research', 'architecture', 'documentation', 'analysis'],
  },
  coder: {
    shortRole: 'Full-Stack Engineer',
    badge: 'INT',
    color: '#3a9c73',
    icon: Code2,
    about:
      'Owns implementation details, ships code, and keeps the product moving from idea to working software.',
    skills: ['frontend', 'backend', 'typescript', 'delivery'],
  },
  tester: {
    shortRole: 'QA Engineer',
    badge: 'REV',
    color: '#d8a14a',
    icon: FlaskConical,
    about:
      'Challenges assumptions, validates flows, and spots edge cases before they turn into regressions.',
    skills: ['qa', 'edge-cases', 'validation', 'review'],
  },
  rnd: {
    shortRole: 'R&D Analyst',
    badge: 'SPC',
    color: '#8a73d8',
    icon: Sparkles,
    about:
      'Tracks product patterns, competitor moves, and high-signal opportunities that sharpen strategy.',
    skills: ['market-intel', 'product', 'positioning', 'research'],
  },
};

export function getAgentCatalog(agents: AgentDefinition[], session: Session | null): AgentCatalogItem[] {
  const taskAgents = new Map<string, { type: string; name: string }>();
  for (const task of session?.tasks ?? []) {
    taskAgents.set(task.agent_type, { type: task.agent_type, name: task.agent_name });
  }

  const items: AgentCatalogItem[] = [];

  items.push({
    type: 'manager',
    name: 'Manager',
    role: 'Mission Manager',
    ...DEFAULT_AGENT_META.manager,
  });

  const seen = new Set<string>(['manager']);

  for (const agent of agents) {
    if (seen.has(agent.type)) continue;
    const fallback = DEFAULT_AGENT_META[agent.type];
    items.push({
      type: agent.type,
      name: agent.name,
      role: agent.description,
      shortRole: fallback?.shortRole ?? agent.description,
      badge: fallback?.badge ?? (agent.is_builtin ? 'AGT' : 'CST'),
      color: agent.color,
      icon: fallback?.icon ?? Bot,
      about: fallback?.about ?? agent.description,
      skills: fallback?.skills ?? inferSkills(agent.description),
    });
    seen.add(agent.type);
  }

  for (const taskAgent of taskAgents.values()) {
    if (seen.has(taskAgent.type)) continue;
    const fallback = DEFAULT_AGENT_META[taskAgent.type];
    items.push({
      type: taskAgent.type,
      name: taskAgent.name,
      role: fallback?.shortRole ?? 'Specialist Agent',
      shortRole: fallback?.shortRole ?? 'Specialist Agent',
      badge: fallback?.badge ?? 'AGT',
      color: fallback?.color ?? '#8f9a9f',
      icon: fallback?.icon ?? Bot,
      about: fallback?.about ?? `${taskAgent.name} contributes as needed to move the mission forward.`,
      skills: fallback?.skills ?? ['execution', 'support'],
    });
  }

  return items;
}

function inferSkills(description: string): string[] {
  return description
    .split(/[\s,/]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 3)
    .slice(0, 4);
}

export function extractMentions(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/@([a-z0-9_-]+)/gi)).map((match) => match[1].toLowerCase())));
}

export function taskComments(taskId: string, comments: Record<string, TaskComment[]>): TaskComment[] {
  return comments[taskId] ?? [];
}

export function taskNeedsReview(task: Task, comments: Record<string, TaskComment[]>): boolean {
  if (task.status !== 'done') return false;
  return taskComments(task.id, comments).some((comment) => {
    const mentions = extractMentions(comment.content);
    return mentions.includes(USER_HANDLE) || comment.comment_type === 'review';
  });
}

export function taskNeedsUserAttention(task: Task, comments: Record<string, TaskComment[]>): boolean {
  return taskComments(task.id, comments).some((comment) => extractMentions(comment.content).includes(USER_HANDLE));
}

export function getMissionLane(task: Task, comments: Record<string, TaskComment[]>): string {
  if (task.status === 'blocked') return 'blocked';
  if (taskNeedsUserAttention(task, comments)) return 'navdeep';
  if (task.status === 'needs_approval' || taskNeedsReview(task, comments)) return 'review';
  if (task.status === 'done') return 'done';
  if (task.status === 'in_progress') return 'in_progress';
  if (task.spawned_by_agent) return 'assigned';
  return 'inbox';
}

export function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'Just now';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDateTime(timestamp: number | null): string {
  if (!timestamp) return 'Not available';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getAgentStatus(agentType: string, session: Session | null): 'working' | 'waiting' | 'done' | 'offline' {
  if (agentType === 'manager') {
    if (!session) return 'offline';
    if (session.status === 'pending' || session.status === 'running') return 'working';
    if (session.status === 'completed') return 'done';
    return 'waiting';
  }

  const tasks = session?.tasks.filter((task) => task.agent_type === agentType) ?? [];
  if (tasks.some((task) => task.status === 'in_progress')) return 'working';
  if (tasks.some((task) => task.status === 'todo')) return 'waiting';
  if (tasks.length > 0 && tasks.every((task) => task.status === 'done')) return 'done';
  return 'offline';
}

export function getMentionedTaskIds(comments: Record<string, TaskComment[]>): string[] {
  return Object.entries(comments)
    .filter(([, taskCommentsForTask]) =>
      taskCommentsForTask.some((comment) => extractMentions(comment.content).includes(USER_HANDLE))
    )
    .map(([taskId]) => taskId);
}

export function getTaskSubAgents(taskId: string, subAgents: SubAgent[]): SubAgent[] {
  return subAgents.filter((sa) => sa.task_id === taskId);
}

export function getTaskNeedsApproval(task: Task): boolean {
  return task.status === 'needs_approval';
}

export function getUserMentions(messages: ChatMessage[], comments: Record<string, TaskComment[]>): Array<{
  id: string;
  source: 'chat' | 'comment';
  content: string;
  agent_name: string;
  created_at: number;
  task_id?: string;
}> {
  const chatMentions = messages
    .filter((message) => extractMentions(message.content).includes(USER_HANDLE))
    .map((message) => ({
      id: message.id,
      source: 'chat' as const,
      content: message.content,
      agent_name: message.agent_name,
      created_at: message.created_at,
    }));

  const commentMentions = Object.values(comments)
    .flat()
    .filter((comment) => extractMentions(comment.content).includes(USER_HANDLE))
    .map((comment) => ({
      id: comment.id,
      source: 'comment' as const,
      content: comment.content,
      agent_name: comment.agent_name,
      created_at: comment.created_at,
      task_id: comment.task_id,
    }));

  return [...chatMentions, ...commentMentions].sort((a, b) => b.created_at - a.created_at);
}
