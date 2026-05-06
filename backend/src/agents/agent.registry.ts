import { BaseAgent } from './base.agent';
import { ResearcherAgent } from './researcher.agent';
import { CoderAgent } from './coder.agent';
import { TesterAgent } from './tester.agent';
import { RndAgent } from './rnd.agent';
import { routeModelCall } from '../services/model-router.service';
import { getActiveCustomAgents as dbGetActiveCustomAgents, getCustomAgentByType } from '../db/queries';
import { CustomAgent, BuiltInAgentDefinition, AgentOverride } from '../types';

const BUILT_IN_AGENTS: Record<string, BaseAgent> = {
  researcher: new ResearcherAgent(),
  coder: new CoderAgent(),
  tester: new TesterAgent(),
  rnd: new RndAgent(),
};

export function getBuiltInAgentDefinitions(): BuiltInAgentDefinition[] {
  return Object.values(BUILT_IN_AGENTS).map((a) => ({
    type: a.type,
    name: a.name,
    description: getBuiltInDescription(a.type),
    systemPrompt: a.systemPrompt,
    model: a.model,
    color: a.color,
    icon: a.icon,
  }));
}

function getBuiltInDescription(type: string): string {
  const descriptions: Record<string, string> = {
    researcher: 'Researches features, libraries, and best practices',
    coder: 'Writes production-ready TypeScript/Node.js/React code',
    tester: 'Writes unit tests, integration tests, and edge cases',
    rnd: 'Analyzes competitors and suggests improvements',
  };
  return descriptions[type] ?? 'Specialized AI agent';
}

export const getActiveCustomAgents = dbGetActiveCustomAgents;

export async function getActiveAgentDescriptions(): Promise<string> {
  const customAgents = await dbGetActiveCustomAgents();
  const lines: string[] = [];

  for (const agent of Object.values(BUILT_IN_AGENTS)) {
    lines.push(`- ${agent.type}: ${getBuiltInDescription(agent.type)}`);
  }

  for (const ca of customAgents) {
    lines.push(`- ${ca.type}: ${ca.description}`);
  }

  return lines.join('\n');
}

export async function resolveAgent(
  agentType: string
): Promise<{ systemPrompt: string; model: string; name: string } | null> {
  if (BUILT_IN_AGENTS[agentType]) {
    const agent = BUILT_IN_AGENTS[agentType];
    return { systemPrompt: agent.systemPrompt, model: agent.model, name: agent.name };
  }

  const customAgent = await getCustomAgentByType(agentType);
  if (customAgent?.is_active) {
    return {
      systemPrompt: customAgent.system_prompt,
      model: customAgent.model,
      name: customAgent.name,
    };
  }

  return null;
}

import { getDynamicFallbacks } from '../services/free-model-pool.service';

import { executeAgenticTask } from './agentic-loop';

export async function executeAgentTask(
  agentType: string,
  taskDescription: string,
  sessionId?: string,
  taskId?: string,
  workspaceDir?: string | null,
  signal?: AbortSignal,
  modelOverride?: string
): Promise<{ content: string; tokensUsed: number; modelUsed: string }> {
  const resolved = await resolveAgent(agentType);
  const fallbackAgent = BUILT_IN_AGENTS['researcher'];
  const { systemPrompt, model: defaultModel, name: agentName } = resolved ?? {
    systemPrompt: fallbackAgent.systemPrompt,
    model: fallbackAgent.model,
    name: 'Agent',
  };

  const primaryModel = modelOverride ?? defaultModel;

  // Use Agentic Loop if workspace is provided
  if (workspaceDir && sessionId && taskId) {
    return executeAgenticTask(
      sessionId,
      taskId,
      agentType,
      agentName,
      taskDescription,
      workspaceDir,
      signal as AbortSignal,
      primaryModel
    );
  }

  const triedModels: string[] = [];
  let lastError: Error = new Error('All models failed for task execution');

  // Step 1: Try the primary (user-selected or default) model
  triedModels.push(primaryModel);
  if (!signal?.aborted) {
    try {
      console.log(`[${agentType}] Executing with primary model: ${primaryModel}`);
      const result = await routeModelCall(
        primaryModel,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: taskDescription },
        ],
        4096,
        signal
      );
      return { ...result, modelUsed: primaryModel, content: result.content || '' };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable = lastError.message.includes('429') || lastError.message.includes('rate limit') || lastError.message.includes('empty content');
      if (!isRetryable) throw lastError;
      console.warn(`[${agentType}] Primary model ${primaryModel} unavailable, fetching dynamic fallbacks...`);
    }
  }

  // Step 2: Dynamically discover all available free models and try each
  const dynamicFallbacks = await getDynamicFallbacks(triedModels);
  console.log(`[${agentType}] Dynamic fallback pool: ${dynamicFallbacks.length} models available`);

  for (const model of dynamicFallbacks) {
    if (signal?.aborted) throw new Error('Request aborted by user');
    triedModels.push(model);
    try {
      console.log(`[${agentType}] Trying fallback model: ${model}`);
      const result = await routeModelCall(
        model,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: taskDescription },
        ],
        4096,
        signal
      );
      return { ...result, modelUsed: model, content: result.content || '' };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable = lastError.message.includes('429') || lastError.message.includes('rate limit') || lastError.message.includes('empty content');
      if (isRetryable) {
        console.warn(`[${agentType}] Fallback model ${model} also unavailable, trying next...`);
        continue;
      }
      throw lastError;
    }
  }

  console.error(`[${agentType}] All ${triedModels.length} models exhausted. Tried: ${triedModels.join(', ')}`);
  throw lastError;
}

export function getAgentDisplayInfo(
  agentType: string,
  customAgentMap: Map<string, CustomAgent>,
  agentOverrides?: Record<string, AgentOverride>
): { name: string; color: string; icon: string } {
  const override = agentOverrides?.[agentType];
  const builtIn = BUILT_IN_AGENTS[agentType];

  if (builtIn) {
    return {
      name: override?.name || builtIn.name,
      color: builtIn.color,
      icon: builtIn.icon,
    };
  }

  const custom = customAgentMap.get(agentType);
  if (custom) {
    return {
      name: override?.name || custom.name,
      color: custom.color,
      icon: custom.icon,
    };
  }

  return { name: agentType, color: '#6B7280', icon: 'Bot' };
}
