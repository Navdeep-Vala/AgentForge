import { routeModelCall } from '../services/model-router.service';
import { getDynamicFallbacks } from '../services/free-model-pool.service';
import { CommentType, OpenRouterCallResult, Task, ChatMessage, OpenRouterMessage } from '../types';

export interface HeartbeatCommentary {
  comment_type: CommentType;
  content: string;
  tokensUsed: number;
}

export interface HeartbeatChatContribution {
  content: string;
  tokensUsed: number;
}

export interface SpawnedTaskPlan {
  agent_type: string;
  title: string;
  description: string;
  spawned_by: string;
}

// ─── Resilient model call with dynamic fallback ──────────────────────────────

async function callWithFallback(
  primaryModel: string,
  messages: OpenRouterMessage[],
  maxTokens: number,
  signal?: AbortSignal,
  label?: string
): Promise<OpenRouterCallResult & { modelUsed: string }> {
  const triedModels: string[] = [];

  // Step 1: Try the primary model
  triedModels.push(primaryModel);
  try {
    const result = await routeModelCall(primaryModel, messages, maxTokens, signal);
    return { ...result, modelUsed: primaryModel };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const isRetryable = error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('empty content');
    if (!isRetryable) throw error;
    console.warn(`[${label ?? 'Heartbeat'}] Primary model ${primaryModel} unavailable, trying fallbacks...`);
  }

  // Step 2: Dynamically try all available free models
  const fallbacks = await getDynamicFallbacks(triedModels);

  for (const model of fallbacks) {
    if (signal?.aborted) throw new Error('Request aborted by user');
    triedModels.push(model);
    try {
      const result = await routeModelCall(model, messages, maxTokens, signal);
      return { ...result, modelUsed: model };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const isRetryable = error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('empty content');
      if (!isRetryable) throw error;
      continue;
    }
  }

  throw new Error(`[${label}] All ${triedModels.length} models exhausted`);
}

// ─── Prompt A: Per-task commentary ───────────────────────────────────────────

export async function generateTaskCommentary(
  agentName: string,
  agentSystemPrompt: string,
  agentModel: string,
  completedByAgentName: string,
  taskTitle: string,
  taskOutput: string,
  signal?: AbortSignal
): Promise<HeartbeatCommentary | null> {
  const userPrompt = `A teammate just completed a task. Review their work and provide commentary if you have anything valuable to add, correct, refute, or praise.

Task completed by: ${completedByAgentName}
Task title: ${taskTitle}
Their output:
---
${taskOutput.slice(0, 3000)}
---

Respond in one of these two formats ONLY:

Format 1 (if you have something to say):
COMMENT_TYPE: [insight | review | refute | praise | question]
CONTENT:
[Your markdown commentary here. Be specific. Reference their work directly.]

Format 2 (if you have nothing to add):
NO_COMMENT`;

  let result: OpenRouterCallResult;
  try {
    const res = await callWithFallback(
      agentModel,
      [
        { role: 'system', content: agentSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      1024,
      signal,
      `Heartbeat-${agentName}`
    );
    result = res;
  } catch {
    return null;
  }

  const text = (result.content ?? '').trim();
  if (text.startsWith('NO_COMMENT') || text === '') return null;

  const commentTypeMatch = text.match(/^COMMENT_TYPE:\s*(insight|review|refute|praise|question)/im);
  const contentMatch = text.match(/CONTENT:\s*([\s\S]+)/im);

  if (!contentMatch) return null;

  const comment_type: CommentType = (commentTypeMatch?.[1]?.toLowerCase() as CommentType) ?? 'insight';
  const content = contentMatch[1].trim();

  return { comment_type, content, tokensUsed: result.tokensUsed };
}

// ─── Prompt B: Chat feed contribution ────────────────────────────────────────

export async function generateChatContribution(
  agentName: string,
  agentSystemPrompt: string,
  agentModel: string,
  sessionGoal: string,
  recentTaskSummary: string,
  recentChatMessages: ChatMessage[],
  signal?: AbortSignal
): Promise<HeartbeatChatContribution | null> {
  const chatText = recentChatMessages
    .slice(-15)
    .map((m) => `[${m.agent_name}]: ${m.content}`)
    .join('\n');

  const userPrompt = `You are ${agentName} on a multi-agent development team working on: "${sessionGoal}"

Recent team activity:
${recentTaskSummary || '(no recent completed tasks)'}

Recent team chat:
${chatText || '(no recent chat messages)'}

If you have an insight, observation, concern, or question worth sharing with the team, post it now. Be specific. Reference actual outputs or tasks.

If you have nothing to share right now, respond with exactly: NO_MESSAGE`;

  let result: OpenRouterCallResult;
  try {
    const res = await callWithFallback(
      agentModel,
      [
        { role: 'system', content: agentSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      512,
      signal,
      `Chat-${agentName}`
    );
    result = res;
  } catch {
    return null;
  }

  const text = (result.content ?? '').trim();
  if (text === 'NO_MESSAGE' || text === '') return null;

  return { content: text, tokensUsed: result.tokensUsed };
}

// ─── Prompt C: Jarvis task spawning ──────────────────────────────────────────

export async function generateTaskSpawnPlan(
  managerModel: string,
  sessionGoal: string,
  agentList: string,
  existingTaskTitles: string[],
  recentChatMessages: ChatMessage[],
  signal?: AbortSignal
): Promise<SpawnedTaskPlan[]> {
  const chatText = recentChatMessages
    .slice(-15)
    .map((m) => `[${m.agent_name}]: ${m.content}`)
    .join('\n');

  const userPrompt = `You are Jarvis, the Squad Lead. Review the team's recent chat for insights that should become new tasks.

Session goal: "${sessionGoal}"
Active agents: ${agentList}
Already-existing tasks (do NOT duplicate):
${existingTaskTitles.map((t) => `- ${t}`).join('\n') || '(none)'}

Recent chat messages:
${chatText || '(none)'}

If any message identifies work that should be done and does NOT already exist as a task, create it.
Return JSON or the literal string NO_NEW_TASKS:

{
  "new_tasks": [
    {
      "agent_type": "tester",
      "title": "Write tests for auth token expiry edge case",
      "description": "Detailed instructions for the agent...",
      "spawned_by": "tester"
    }
  ]
}`;

  let result: OpenRouterCallResult;
  try {
    const res = await callWithFallback(
      managerModel,
      [{ role: 'user', content: userPrompt }],
      1024,
      signal,
      'TaskSpawn'
    );
    result = res;
  } catch {
    return [];
  }

  const text = (result.content ?? '').trim();
  if (text === 'NO_NEW_TASKS' || text === '') return [];

  try {
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { new_tasks: SpawnedTaskPlan[] };
    return Array.isArray(parsed.new_tasks) ? parsed.new_tasks : [];
  } catch {
    return [];
  }
}

// ─── Build task summary for heartbeat context ─────────────────────────────────

export function buildTaskSummary(tasks: Task[]): string {
  return tasks
    .map(
      (t) =>
        `- [${t.agent_name}] "${t.title}" (${t.status})${t.output ? `\n  Output preview: ${t.output.slice(0, 200)}...` : ''}`
    )
    .join('\n');
}
