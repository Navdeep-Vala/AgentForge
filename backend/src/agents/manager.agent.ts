import { callOpenRouter } from '../services/openrouter.service';
import { ManagerTaskPlan, OpenRouterMessage } from '../types';
import { env } from '../config/env';

const MANAGER_SYSTEM_PROMPT = `You are the Manager AI in a development team. Your job is to:
1. Determine if the user input is a real, actionable project goal.
   - If it is a greeting, test message, random text, or anything that is NOT a software/product/research goal, return: {"tasks": [], "error": "Input is not a project goal."}
2. If it IS a real goal, break it down into specific, actionable tasks and assign each to the right specialist: researcher, coder, tester, or rnd (or any custom agent type listed).
3. Return ONLY valid JSON in this exact format:
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

// Fallback models tried in order when the primary is rate-limited or unavailable
const FALLBACK_MODELS = [
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-3-27b-it:free',
];

export class ManagerAgent {
  readonly model: string;

  constructor() {
    this.model = env.MANAGER_MODEL;
  }

  async decompose(
    goal: string,
    activeAgentDescriptions: string,
    signal?: AbortSignal
  ): Promise<ManagerTaskPlan> {
    const userMessage = `Goal: ${goal}\n\nActive agents available:\n${activeAgentDescriptions}`;
    const messages = [
      { role: 'system' as const, content: MANAGER_SYSTEM_PROMPT },
      { role: 'user' as const, content: userMessage },
    ];

    // Try primary model then each fallback
    const modelsToTry = [this.model, ...FALLBACK_MODELS.filter((m) => m !== this.model)];
    let lastError: Error = new Error('All models failed during decomposition');

    for (const model of modelsToTry) {
      if (signal?.aborted) throw new Error('Request aborted by user');
      try {
        console.log(`[Manager] Decomposing with model: ${model}`);
        const result = await callOpenRouter(model, messages, 2048, signal);

        let parsed: ManagerTaskPlan;
        try {
          const jsonText = extractJson(result.content);
          parsed = JSON.parse(jsonText) as ManagerTaskPlan;
        } catch {
          throw new Error(`Manager returned invalid JSON: ${result.content.slice(0, 200)}`);
        }

        const maybeError = (parsed as { error?: string }).error;
        if (maybeError) {
          throw new Error(`Not a project goal: ${maybeError}`);
        }

        if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
          throw new Error('Manager returned no tasks. Try rephrasing your goal.');
        }

        return parsed;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRateLimit = lastError.message.includes('429') || lastError.message.includes('rate limit');
        const isEmpty = lastError.message.includes('empty content');
        if (isRateLimit || isEmpty) {
          console.warn(`[Manager] Model ${model} unavailable (${lastError.message}), trying next fallback...`);
          continue;
        }
        // Non-rate-limit errors (invalid JSON, auth, abort) — don't retry other models
        throw lastError;
      }
    }

    throw lastError;
  }

  async synthesize(
    goal: string,
    taskResults: Array<{ title: string; agentName: string; output: string | null }>,
    signal?: AbortSignal
  ): Promise<string> {
    const taskSummaries = taskResults
      .map((t) => `## ${t.title} (by ${t.agentName})\n${t.output ?? '_No output_'}`)
      .join('\n\n');

    const userMessage = buildSynthesisPrompt(goal, taskSummaries);

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const result = await callOpenRouter(this.model, messages, 4096, signal);
    return result.content;
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
