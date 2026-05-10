import { BaseAgent } from './base.agent';
import { emitSSE } from '../controllers/sse.controller';
import { callOpenRouter } from '../services/openrouter.service';
import { routeModelCall } from '../services/model-router.service';
import { getDynamicFallbacks } from '../services/free-model-pool.service';
import { ManagerTaskPlan, OpenRouterMessage } from '../types';
import { env } from '../config/env';

const MANAGER_SYSTEM_PROMPT = `You are the Manager AI in a development team. Your job is to:
1. Determine if the user input is a real, actionable project goal.
   - If it is a greeting, test message, random text, or anything that is NOT a software/product/research/data-automation goal, return: {"tasks": [], "error": "Input is not a project goal."}
2. If it IS a real goal, break it down into only the necessary, actionable tasks and assign each to the right specialist: researcher, coder, tester, rnd (or any custom agent type listed).
   - Note: Your team is fully capable of creating Excel spreadsheets, CSVs, and PDF reports using Python (via 'execute_code'). Coder or specialized data agents should handle these.
3. Each task description should be detailed enough that the agent can execute autonomously. Include specifics about what files to modify, what patterns to follow, and what the acceptance criteria are.
4. **Parallel Sub-Agent Delegation**: If a task involves complex multi-step work where specialized sub-agents could help (e.g., checking individual files, running parallel error checks, testing specific modules), EXPLICITLY instruct the agent in its task description to use "spawn_sub_agent" to delegate sub-tasks in parallel to speed up the process (e.g., "Spawn parallel sub-agents for file checking and error verification on each file").
5. **Specialized On-The-Go Agents**: If the goal requires a very specific specialized skill that NO existing built-in agent covers (e.g., "database schema migration", "accessibility auditing", "internationalization", "performance profiling", "GraphQL optimization", "API gateway design"), you MUST create a new specialized agent type by setting agent_type to a new, unique type name (e.g., "db_migration_specialist", "a11y_auditor", "i18n_specialist", "perf_profiler", "graphql_optimizer", "api_gateway_designer") and provide a detailed description. The system will automatically create this agent for you to execute the task. Use this when:
   - The task requires deep expertise in a narrow domain not covered by existing agents (researcher, coder, tester, rnd)
   - The task involves a multi-step specialized workflow that benefits from a dedicated agent
   - You need to delegate work to a "mini-team" of 2+ specialized sub-agents working in parallel
   - The domain expertise is too specific for a general-purpose agent
   When creating a specialized agent, also specify in the task description what sub-agents should spawn in parallel.
6. **Advanced Tool Usage**: Instruct agents to use "web_search" to research documentation or solutions, and "execute_code" to validate logic in a safe sandbox. These tools are available to ALL agents.
7. **Notification/Mention System**: Whenever an agent needs to reach out to the user (navdeep) for clarification or approval, they must use the "@navdeep" mention in their communication. This will trigger a notification for the user. Instruct all agents to use this pattern.
8. **Coder Agent Workflow** (MANDATORY for all coding tasks):
   - Instruct the coder to:
     a. Analyze task and request clarification if needed (using "@navdeep" mention)
     b. Write code following standards
     c. Spawn parallel sub-agents: file_checker (for each file), error_checker (for each file), and code_reviewer
     d. Aggregate feedback and fix issues
     e. Use request_approval with "@navdeep" mention to submit code for human review
     f. WAIT for approval and COMMIT code ONLY after approval is granted
8. **Tester Agent Workflow** (MANDATORY when testing is needed):
   - Instruct the tester to:
     a. WAIT for the coder's task to be approved and committed (status: "done")
     b. Spawn parallel sub-agents: test_runner, security_auditor
     c. Use request_approval with "@navdeep" mention to submit test results
9. **Strict Deliverable Compliance**:
   - You MUST ensure the task description explicitly mentions the requested format (e.g., "Generate an EXCEL sheet", "Write PYTHON code", "Create a PDF report").
   - Instruct agents to double-check the user's requested format before starting to avoid defaulting to their "favorite" stack.
10. **Critical Approval Workflow**: 
   - No code should be committed without human (navdeep) approval.
   - The tester starts ONLY after the coder's work is approved and committed.
11. Do NOT create one task per agent by default. Only use agents whose skills are genuinely needed for this goal.
12. Prefer fewer, higher-signal tasks. If one agent can reasonably own a task, keep ownership with that agent.
13. Return ONLY valid JSON in this exact format:
{
  "thought": "Your internal monologue explaining how you analyzed the goal, decided on the orchestration strategy, why you chose specific agents, and how you plan to manage parallel sub-agent delegation...",
  "tasks": [
    {
      "agent_type": "researcher|coder|tester|rnd|<specialized_agent_type>",
      "title": "Short task title",
      "description": "Detailed instructions for this agent including sub-agent delegation instructions, deliverable format requirements, and @navdeep mention requirements..."
    }
  ]
}
Do not include any text outside the JSON object.`;

const SYNTHESIS_SYSTEM_PROMPT = `You are the Manager of an AI development team. Synthesize the team's findings into a comprehensive final report formatted as clean markdown.`;

export class ManagerAgent extends BaseAgent {
  readonly type = 'manager';
  readonly name = 'Manager';
  readonly color = '#d8892d';
  readonly icon = 'Zap';
  readonly model: string;
  readonly systemPrompt = MANAGER_SYSTEM_PROMPT;

  constructor() {
    super();
    this.model = env.MANAGER_MODEL;
  }

  async decompose(
    sessionId: string,
    goal: string,
    activeAgentDescriptions: string,
    signal?: AbortSignal,
    modelOverride?: string,
    context?: { completedTasks?: Array<{ title: string; output: string }>; pendingTasks?: Array<{ title: string; description: string }> }
  ): Promise<ManagerTaskPlan> {
    const contextStr = [];
    if (context?.completedTasks && context.completedTasks.length > 0) {
      contextStr.push('Completed tasks:\n' + context.completedTasks.map(t => `- ${t.title}: ${t.output.slice(0, 200)}`).join('\n'));
    }
    if (context?.pendingTasks && context.pendingTasks.length > 0) {
      contextStr.push('Pending/queued tasks:\n' + context.pendingTasks.map(t => `- ${t.title}: ${t.description.slice(0, 200)}`).join('\n'));
    }

    const userMessage = `Goal: ${goal}\n\nActive agents available:\n${activeAgentDescriptions}${contextStr.length > 0 ? '\n\n' + contextStr.join('\n\n') : ''}`;
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
      emitSSE(sessionId, { 
        type: 'agent_thinking', 
        agentType: 'manager', 
        agentName: 'Manager', 
        message: `Orchestrating mission with ${primaryModel}...` 
      });
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
      emitSSE(sessionId, { 
        type: 'model_retry', 
        agentType: 'manager', 
        agentName: 'Manager', 
        previousModel: primaryModel,
        nextModel: model,
        message: `Primary model failed. Retrying with fallback: ${model}...` 
      });
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
      emitSSE(sessionId, { 
        type: 'agent_thinking', 
        agentType: 'manager', 
        agentName: 'Manager', 
        message: 'Synthesizing final mission report...' 
      });
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

  async verifyTask(
    sessionId: string,
    task: { title: string; description: string; agent_type: string },
    output: string,
    signal?: AbortSignal
  ): Promise<{ verified: boolean; feedback?: string }> {
    const prompt = `You are the Manager. Verify if the following task has been successfully completed according to its description and deliverables.
Task Title: ${task.title}
Task Description: ${task.description}
Agent Type: ${task.agent_type}

Agent Output:
${output}

Analyze if the agent actually delivered what was requested (e.g., if an Excel file was requested, did they mention creating it? If code was requested, is it present?).
Return ONLY valid JSON:
{
  "verified": true|false,
  "feedback": "If not verified, explain exactly what is missing or what the agent needs to do differently. If verified, keep this empty."
}`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: 'You are a rigorous Manager. Your goal is to ensure high quality and deliverable compliance.' },
      { role: 'user', content: prompt },
    ];

    try {
      emitSSE(sessionId, { 
        type: 'agent_thinking', 
        agentType: 'manager', 
        agentName: 'Manager', 
        message: `Verifying deliverable for "${task.title}"...` 
      });
      const result = await routeModelCall(this.model, messages, 1024, signal);
      const parsed = JSON.parse(extractJson(result.content ?? '')) as { verified: boolean; feedback?: string };
      return parsed;
    } catch (err) {
      console.error(`[Manager] Verification failed:`, err);
      // Fallback to verified if the model fails to keep the loop moving, but log it
      return { verified: true };
    }
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
