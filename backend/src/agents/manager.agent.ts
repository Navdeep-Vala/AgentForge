import { callOpenRouter } from '../services/openrouter.service';
import { routeModelCall } from '../services/model-router.service';
import { getDynamicFallbacks } from '../services/free-model-pool.service';
import { ManagerTaskPlan, OpenRouterMessage } from '../types';
import { env } from '../config/env';

const MANAGER_SYSTEM_PROMPT = `You are the Manager AI in a development team. Your job is to:
1. Determine if the user input is a real, actionable project goal.
   - If it is a greeting, test message, random text, or anything that is NOT a software/product/research goal, return: {"tasks": [], "error": "Input is not a project goal."}
2. If it IS a real goal, break it down into only the necessary, actionable tasks and assign each to the right specialist: researcher, coder, tester, or rnd (or any custom agent type listed).
3. Do NOT create one task per agent by default. Only use agents whose skills are genuinely needed for this goal.
4. Prefer fewer, higher-signal tasks. If one agent can reasonably own a task, keep ownership with that agent.
5. Do NOT assign collaboration tasks up front unless the goal explicitly requires a handoff. Cross-agent collaboration should happen later through mentions and follow-up tasks only when needed.
6. Return ONLY valid JSON in this exact format:
{
  "tasks": [
    {
      "agent_type": "researcher",
      "title": "Short task title",
      "description": "Detailed instructions for this agent..."
    }
  ]
}
Do not include any text outside the JSON object.`;

const SYNTHESIS_SYSTEM_PROMPT = `You are the Manager of an AI development team. Synthesize the team's findings into a comprehensive final report formatted as clean markdown.`;

export class ManagerAgent {
  readonly model: string;

  constructor() {
    this.model = env.MANAGER_MODEL;
  }

  async decompose(
    goal: string,
    activeAgentDescriptions: string,
    signal?: AbortSignal,
    modelOverride?: string
  ): Promise<ManagerTaskPlan> {
    const userMessage = `Goal: ${goal}\n\nActive agents available:\n${activeAgentDescriptions}`;
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: MANAGER_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const primaryModel = modelOverride ?? this.model;
    const triedModels: string[] = [];
    let lastError: Error = new Error('All models failed during decomposition');

    // Step 1: Try the primary model
    triedModels.push(primaryModel);
    if (!signal?.aborted) {
      try {
        console.log(`[Manager] Decomposing with primary model: ${primaryModel}`);
        const result = await routeModelCall(primaryModel, messages, 2048, signal);
        return this.parseDecomposition(result.content ?? '');
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRetryable = lastError.message.includes('429') || lastError.message.includes('rate limit') || lastError.message.includes('empty content');
        if (!isRetryable) throw lastError;
        console.warn(`[Manager] Primary model ${primaryModel} unavailable, fetching dynamic fallbacks...`);
      }
    }

    // Step 2: Dynamically try all available free models
    const dynamicFallbacks = await getDynamicFallbacks(triedModels);
    console.log(`[Manager] Dynamic fallback pool: ${dynamicFallbacks.length} models available`);

    for (const model of dynamicFallbacks) {
      if (signal?.aborted) throw new Error('Request aborted by user');
      triedModels.push(model);
      try {
        console.log(`[Manager] Trying fallback model: ${model}`);
        const result = await routeModelCall(model, messages, 2048, signal);
        return this.parseDecomposition(result.content ?? '');
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRetryable = lastError.message.includes('429') || lastError.message.includes('rate limit') || lastError.message.includes('empty content');
        if (isRetryable) {
          console.warn(`[Manager] Fallback model ${model} also unavailable, trying next...`);
          continue;
        }
        // Non-retryable errors (invalid JSON, auth, abort) — don't retry
        throw lastError;
      }
    }

    console.error(`[Manager] All ${triedModels.length} models exhausted. Tried: ${triedModels.join(', ')}`);
    throw lastError;
  }

  async synthesize(
    goal: string,
    taskResults: Array<{ title: string; agentName: string; output: string | null }>,
    signal?: AbortSignal,
    modelOverride?: string
  ): Promise<string> {
    const taskSummaries = taskResults
      .map((t) => `## ${t.title} (by ${t.agentName})\n${t.output ?? '_No output_'}`)
      .join('\n\n');

    const userMessage = buildSynthesisPrompt(goal, taskSummaries);

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const primaryModel = modelOverride ?? this.model;
    const triedModels: string[] = [];
    let lastError: Error = new Error('All models failed during synthesis');

    // Step 1: Try the primary model
    triedModels.push(primaryModel);
    if (!signal?.aborted) {
      try {
        console.log(`[Manager] Synthesizing with primary model: ${primaryModel}`);
        const result = await routeModelCall(primaryModel, messages, 4096, signal);
        return result.content ?? '';
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRetryable = lastError.message.includes('429') || lastError.message.includes('rate limit') || lastError.message.includes('empty content');
        if (!isRetryable) throw lastError;
        console.warn(`[Manager] Primary model ${primaryModel} unavailable for synthesis, trying fallbacks...`);
      }
    }

    // Step 2: Dynamically try all available free models
    const dynamicFallbacks = await getDynamicFallbacks(triedModels);

    for (const model of dynamicFallbacks) {
      if (signal?.aborted) throw new Error('Request aborted by user');
      triedModels.push(model);
      try {
        console.log(`[Manager] Synthesizing with fallback model: ${model}`);
        const result = await routeModelCall(model, messages, 4096, signal);
        return result.content ?? '';
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRetryable = lastError.message.includes('429') || lastError.message.includes('rate limit') || lastError.message.includes('empty content');
        if (isRetryable) {
          console.warn(`[Manager] Synthesis fallback ${model} unavailable, trying next...`);
          continue;
        }
        throw lastError;
      }
    }

    console.error(`[Manager] Synthesis: all ${triedModels.length} models exhausted.`);
    throw lastError;
  }

  private parseDecomposition(content: string): ManagerTaskPlan {
    let parsed: ManagerTaskPlan;
    try {
      const jsonText = extractJson(content);
      parsed = JSON.parse(jsonText) as ManagerTaskPlan;
    } catch {
      throw new Error(`Manager returned invalid JSON: ${content.slice(0, 200)}`);
    }

    const maybeError = (parsed as { error?: string }).error;
    if (maybeError) {
      throw new Error(`Not a project goal: ${maybeError}`);
    }

    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new Error('Manager returned no tasks. Try rephrasing your goal.');
    }

    return parsed;
  }
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  return text.trim();
}

function buildSynthesisPrompt(goal: string, taskSummaries: string): string {
  return `The team has completed the following tasks for this goal: "${goal}"

Here are all their outputs:

${taskSummaries}

Write a comprehensive final report that:
1. Summarizes the key findings from each agent
2. Provides a clear implementation roadmap (numbered steps)
3. Highlights the most important code snippets to use
4. Notes any conflicts or things to watch out for
5. Ends with a "Quick Start" section (3-5 bullet points)

Format as clean markdown.`;
}
