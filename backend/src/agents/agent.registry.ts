import { BaseAgent } from './base.agent';
import { ResearcherAgent } from './researcher.agent';
import { CoderAgent } from './coder.agent';
import { TesterAgent } from './tester.agent';
import { RndAgent } from './rnd.agent';
import { routeModelCall } from '../services/model-router.service';
import { getActiveCustomAgents as dbGetActiveCustomAgents, getCustomAgentByType } from '../db/queries';
import { CustomAgent, BuiltInAgentDefinition } from '../types';

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

const AGENT_FALLBACK_MODELS: Record<string, string[]> = {
  researcher: ['nvidia/nemotron-3-super-120b-a12b:free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'],
  coder:      ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-4-31b-it:free', 'nousresearch/hermes-3-llama-3.1-405b:free'],
  tester:     ['google/gemma-4-31b-it:free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'],
  rnd:        ['google/gemma-4-31b-it:free', 'meta-llama/llama-3.3-70b-instruct:free', 'nousresearch/hermes-3-llama-3.1-405b:free'],
};

export async function executeAgentTask(
  agentType: string,
  taskDescription: string,
  signal?: AbortSignal,
  modelOverride?: string
): Promise<{ content: string; tokensUsed: number; modelUsed: string }> {
  const resolved = await resolveAgent(agentType);
  const fallbackAgent = BUILT_IN_AGENTS['researcher'];
  const { systemPrompt, model: defaultModel } = resolved ?? {
    systemPrompt: fallbackAgent.systemPrompt,
    model: fallbackAgent.model,
  };

  const primaryModel = modelOverride ?? defaultModel;
  const fallbacks = AGENT_FALLBACK_MODELS[agentType] ?? [];
  const modelsToTry = [primaryModel, ...fallbacks.filter((m) => m !== primaryModel)];
  let lastError: Error = new Error('All models failed for task execution');

  for (const model of modelsToTry) {
    if (signal?.aborted) throw new Error('Request aborted by user');
    try {
      console.log(`[${agentType}] Executing with model: ${model}`);
      const result = await routeModelCall(
        model,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: taskDescription },
        ],
        4096,
        signal
      );
      return { ...result, modelUsed: model };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRateLimit = lastError.message.includes('429') || lastError.message.includes('rate limit');
      const isEmpty = lastError.message.includes('empty content');
      if (isRateLimit || isEmpty) {
        console.warn(`[${agentType}] Model ${model} unavailable, trying fallback...`);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

export function getAgentDisplayInfo(
  agentType: string,
  customAgentMap: Map<string, CustomAgent>
): { name: string; color: string; icon: string } {
  const builtIn = BUILT_IN_AGENTS[agentType];
  if (builtIn) {
    return { name: builtIn.name, color: builtIn.color, icon: builtIn.icon };
  }

  const custom = customAgentMap.get(agentType);
  if (custom) {
    return { name: custom.name, color: custom.color, icon: custom.icon };
  }

  return { name: agentType, color: '#6B7280', icon: 'Bot' };
}
