import { WorkspaceManager } from '../workspace/workspace.manager';
import { FileService } from '../workspace/file.service';
import { DockerService } from '../sandbox/docker.service';
import { SandboxCommandService } from '../workspace/sandbox-command.service';
import { GitService } from '../workspace/git.service';
import { CommandService } from '../workspace/command.service';
import { ToolExecutor } from '../workspace/tool-executor';
import { AGENT_TOOLS } from '../workspace/tools';
import { routeModelCall } from '../services/model-router.service';
import {
  OpenRouterMessage,
  OpenRouterCallResult,
  SubAgent,
  SubAgentType,
  ClarificationRequest,
  TaskStatus,
} from '../types';
import { emitSSE } from '../controllers/sse.controller';
import { v4 as uuidv4 } from 'uuid';
import * as queries from '../db/queries';
import { getActiveCustomAgents, resolveAgent } from './agent.registry';
import { env } from '../config/env';

export interface AgentTaskResult {
  content: string;
  tokensUsed: number;
  modelUsed: string;
  status?: TaskStatus;
  subAgents?: SubAgent[];
  clarifications?: ClarificationRequest[];
  spawnRequests?: Array<{ agentType: string; title: string; description: string }>;
  thought?: string;
}

// ─── Sub-Agent Execution Engine ───────────────────────────────────────────────

export async function executeSubAgents(
  sessionId: string,
  parentTaskId: string,
  workspaceDir: string,
  signal: AbortSignal,
  description: string,
  subAgentPlans: Array<{ subAgentType: SubAgentType; title: string; description: string }>,
  containerId?: string
): Promise<SubAgent[]> {
  const results: SubAgent[] = [];

  // Execute all sub-agents in parallel
  const promises = subAgentPlans.map(async (plan) => {
    const subAgentId = uuidv4();
    const subAgent: SubAgent = {
      id: subAgentId,
      task_id: parentTaskId,
      session_id: sessionId,
      sub_agent_type: plan.subAgentType,
      title: plan.title,
      description: plan.description,
      status: 'pending',
      output: null,
      thought: null,
      started_at: null,
      completed_at: null,
      created_at: Date.now(),
    };

    await queries.createSubAgent(subAgent);
    emitSSE(sessionId, {
      type: 'sub_agent_spawned',
      taskId: parentTaskId,
      subAgentId,
      subAgentType: plan.subAgentType,
      title: plan.title,
    });

    try {
      // Build a focused prompt for the sub-agent
      const subAgentPrompt = buildSubAgentPrompt(plan.subAgentType, plan.title, plan.description, description);

      // Use a dedicated model for certain sub-agent types
      const model = selectSubAgentModel(plan.subAgentType);

      // Check if we have a custom agent for this sub-agent type
      const customAgents = await getActiveCustomAgents();
      const customAgent = customAgents.find((a) => a.type === plan.subAgentType);

      let systemPrompt: string;
      if (customAgent) {
        systemPrompt = customAgent.system_prompt;
      } else {
        systemPrompt = subAgentPrompt;
      }

      const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: plan.description },
      ];

      emitSSE(sessionId, {
        type: 'sub_agent_spawned',
        taskId: parentTaskId,
        subAgentId,
        subAgentType: plan.subAgentType,
        title: plan.title,
      });

      // Execute via appropriate method
      let output: string;
      if (workspaceDir) {
        // Use agentic loop for workspace-based sub-agents
        const result = await executeAgenticTask(
          sessionId,
          subAgentId,
          plan.subAgentType,
          plan.title,
          plan.description,
          workspaceDir,
          signal,
          model,
          containerId
        );
        output = result.content;
        subAgent.thought = result.thought;
      } else {
        // Direct LLM call for non-workspace sub-agents
        const result = await routeModelCall(model, messages, 4096, signal);
        output = result.content || '';
      }

      subAgent.status = 'completed';
      subAgent.output = output;
      subAgent.completed_at = Date.now();

      await queries.updateSubAgentStatus(subAgent.id, 'completed', output, subAgent.thought);

      emitSSE(sessionId, {
        type: 'sub_agent_complete',
        taskId: parentTaskId,
        subAgentId: subAgent.id,
        subAgentType: plan.subAgentType,
        title: plan.title,
        output,
        thought: subAgent.thought || undefined,
      });
    } catch (err) {
      subAgent.status = 'failed';
      subAgent.output = `Error: ${err instanceof Error ? err.message : String(err)}`;
      subAgent.completed_at = Date.now();

      await queries.updateSubAgentStatus(subAgent.id, 'failed', subAgent.output);

      emitSSE(sessionId, {
        type: 'sub_agent_failed',
        taskId: parentTaskId,
        subAgentId: subAgent.id,
        subAgentType: plan.subAgentType,
        title: plan.title,
      });
    }

    results.push(subAgent);
    return subAgent;
  });

  const settled = await Promise.allSettled(promises);
  const completedAgents: SubAgent[] = [];

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      completedAgents.push(result.value);
    }
  }

  return completedAgents;
}

function buildSubAgentPrompt(
  subAgentType: SubAgentType,
  title: string,
  description: string,
  parentDescription: string
): string {
  switch (subAgentType) {
    case 'file_checker':
      return `You are a File Checker sub-agent. Your job is to examine specific files in the codebase and report their status, structure, and any issues.

Given the following context:
${parentDescription}

Your specific task:
${title}
${description}

Check each file thoroughly and report:
- File existence and accessibility
- File structure and formatting
- Any issues or inconsistencies found
- Suggestions for improvement`;

    case 'error_checker':
      return `You are an Error Checker sub-agent. Your job is to identify and analyze errors, bugs, and potential issues in code.

Given the following context:
${parentDescription}

Your specific task:
${title}
${description}

Analyze the code thoroughly and report:
- All errors and bugs found with line numbers
- Potential runtime issues
- Type errors or inconsistencies
- Security vulnerabilities
- Performance concerns
- Recommended fixes for each issue`;

    case 'test_runner':
      return `You are a Test Runner sub-agent. Your job is to run tests and analyze the results.

Given the following context:
${parentDescription}

Your specific task:
${title}
${description}

Run the tests and report:
- Which tests passed and which failed
- Error messages and stack traces for failures
- Coverage statistics if available
- Recommendations for fixing failing tests`;

    case 'code_reviewer':
      return `You are a Code Reviewer sub-agent. Your job is to review code for quality, standards compliance, and best practices.

Given the following context:
${parentDescription}

Your specific task:
${title}
${description}

Review the code thoroughly and report:
- Code quality and readability assessment
- Whether coding standards are followed
- Potential bugs or logical errors
- Performance optimizations
- Security issues
- Architecture and design suggestions`;

    case 'security_auditor':
      return `You are a Security Auditor sub-agent. Your job is to identify security vulnerabilities and risks in the code.

Given the following context:
${parentDescription}

Your specific task:
${title}
${description}

Audit the code and report:
- Security vulnerabilities (XSS, SQL injection, etc.)
- Authentication/authorization issues
- Data exposure risks
- Dependency vulnerabilities
- Compliance concerns
- Remediation recommendations`;

    default:
      return `You are a specialized sub-agent (${subAgentType}). Complete the following task:

${title}
${description}

Context: ${parentDescription}`;
  }
}

function selectSubAgentModel(subAgentType: SubAgentType): string {
  switch (subAgentType) {
    case 'code_reviewer':
    case 'error_checker':
      return 'qwen/qwen3-coder:free';
    case 'security_auditor':
      return 'nousresearch/hermes-3-llama-3.1-405b:free';
    case 'test_runner':
      return 'meta-llama/llama-3.3-70b-instruct:free';
    default:
      return 'google/gemma-3-27b-it:free';
  }
}

// ─── Dynamic Custom Agent Creation ────────────────────────────────────────────

export async function createDynamicCustomAgent(
  agentType: string,
  agentName: string,
  description: string,
  expertise: string
): Promise<{ id: string; type: string; name: string }> {
  // Check if agent already exists
  const existingAgent = await queries.getCustomAgentByType(agentType);
  if (existingAgent && existingAgent.is_active) {
    return { id: existingAgent.id, type: existingAgent.type, name: existingAgent.name };
  }

  // Generate a specialized system prompt for this agent
  const systemPrompt = buildSpecializedAgentPrompt(agentType, agentName, description, expertise);

  // Create the custom agent
  const customAgent = {
    id: uuidv4(),
    name: agentName,
    type: agentType,
    description,
    system_prompt: systemPrompt,
    model: selectSpecializedAgentModel(agentType),
    color: generateColorForAgent(agentType),
    icon: 'Zap', // Specialized agents get the lightning bolt icon
    is_active: true,
    created_at: Date.now(),
  };

  await queries.createCustomAgent(customAgent);
  return { id: customAgent.id, type: customAgent.type, name: customAgent.name };
}

function buildSpecializedAgentPrompt(
  agentType: string,
  agentName: string,
  description: string,
  expertise: string
): string {
  return `You are ${agentName}, a specialized AI agent with deep expertise in ${expertise}.

## Your Domain
${description}

## Key Responsibilities
- Apply your specialized knowledge to solve problems in your domain
- Provide expert-level analysis and recommendations
- Work with other agents and sub-agents as part of a larger team
- Communicate findings clearly in technical reports
- Flag issues and risks within your domain of expertise

## Standards
- Follow industry best practices in your domain
- Provide well-reasoned recommendations with supporting evidence
- Highlight assumptions and potential risks
- Ask for clarification if requirements are unclear using request_clarification
- Submit major work for approval using request_approval when appropriate

## Tools
You have access to standard tools: read_file, write_file, run_command, list_directory, git operations, etc.
You can also spawn parallel sub-agents for verification work using spawn_sub_agent.

## Workflow
1. Analyze requirements and request clarification if needed
2. Assess the situation using available tools
3. Provide expert analysis and recommendations
4. If major changes are suggested, request approval before proceeding
5. Complete the task with a summary of findings

Remember: You are a specialized expert. Use your domain knowledge confidently, but ask for clarification when scope or requirements are unclear.`;
}

function selectSpecializedAgentModel(agentType: string): string {
  // Default model selection for specialized agents
  // Can be customized based on agent type
  const modelMap: Record<string, string> = {
    db_migration_specialist: 'qwen/qwen3-coder:free',
    a11y_auditor: 'google/gemma-4-31b-it:free',
    i18n_specialist: 'google/gemma-4-31b-it:free',
    perf_profiler: 'qwen/qwen3-coder:free',
    graphql_optimizer: 'qwen/qwen3-coder:free',
    api_gateway_designer: 'meta-llama/llama-3.3-70b-instruct:free',
    security_specialist: 'nousresearch/hermes-3-llama-3.1-405b:free',
    wasm_specialist: 'qwen/qwen3-coder:free',
    kubernetes_architect: 'meta-llama/llama-3.3-70b-instruct:free',
  };

  return modelMap[agentType] || 'meta-llama/llama-3.3-70b-instruct:free';
}

function generateColorForAgent(agentType: string): string {
  // Generate a consistent color based on agent type
  const colors = ['#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4', '#10B981', '#6366F1', '#F97316', '#EF4444'];
  const hash = agentType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// ─── Clarification Request System ─────────────────────────────────────────────

export async function requestClarification(
  sessionId: string,
  taskId: string,
  agentType: string,
  agentName: string,
  question: string,
  context: string | null,
  options: string[] | null,
  signal?: AbortSignal
): Promise<ClarificationRequest> {
  const clarificationId = uuidv4();
  const now = Date.now();

  const clarification: ClarificationRequest = {
    id: clarificationId,
    session_id: sessionId,
    task_id: taskId,
    agent_type: agentType,
    agent_name: agentName,
    question,
    context,
    options,
    status: 'pending',
    created_at: now,
    answered_at: null,
  };

  await queries.createClarificationRequest(clarification);

  const hasMention = question.includes('@navdeep') || (context?.includes('@navdeep') ?? false);
  
  emitSSE(sessionId, {
    type: 'clarification_request',
    requestId: clarificationId,
    taskId,
    agentType,
    agentName,
    question,
    context,
    options,
    notify: hasMention,
  });

  // Wait for clarification to be answered (with timeout)
  const timeoutMs = 300000; // 5 minutes default
  const startTime = Date.now();

  while (!signal?.aborted) {
    if (Date.now() - startTime > timeoutMs) {
      // Timeout - auto-expire the clarification
      await queries.answerClarificationRequest(clarificationId, '[AUTO-EXPIRED: No response received within timeout period]');
      const updated = (await queries.getClarificationRequestsBySessionId(sessionId))
        .find((c) => c.id === clarificationId);
      if (updated) {
        emitSSE(sessionId, {
          type: 'clarification_response',
          requestId: clarificationId,
          taskId,
          response: updated.answer || '',
        });
      }
      throw new Error(`Clarification request timed out after ${timeoutMs / 1000}s: ${question}`);
    }

    // Check for new answers
    const requests = await queries.getClarificationRequestsBySessionId(sessionId);
    const req = requests.find((r) => r.id === clarificationId);
    if (req && req.status === 'answered') {
      emitSSE(sessionId, {
        type: 'clarification_response',
        requestId: clarificationId,
        taskId,
        response: req.answer || '[No answer provided]',
      });
      return req;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2 seconds
  }

  throw new Error('Task aborted while waiting for clarification');
}

// ─── Approval Gate System ────────────────────────────────────────────────────

export async function setTaskNeedsApproval(
  sessionId: string,
  taskId: string,
): Promise<void> {
  await queries.updateTaskStatus(taskId, 'needs_approval');

  const task = await queries.getTaskById(taskId);
  if (task) {
    const hasMention = (task.output || '').includes('@navdeep');
    
    emitSSE(sessionId, {
      type: 'needs_approval',
      taskId,
      agentType: task.agent_type,
      agentName: task.agent_name,
      title: task.title,
      output: task.output || '',
      notify: hasMention,
    });
  }
}

// ─── Main Agentic Loop ───────────────────────────────────────────────────────

export async function executeAgenticTask(
  sessionId: string,
  taskId: string,
  agentType: string,
  agentName: string,
  taskDescription: string,
  workspaceDir: string,
  signal: AbortSignal,
  modelOverride?: string,
  containerId?: string,
  predecessorTaskStatus?: TaskStatus
): Promise<AgentTaskResult> {
  const workspace = new WorkspaceManager(workspaceDir);
  const fileService = new FileService(workspace);

  let commandService: CommandService | SandboxCommandService;
  let gitService: GitService | null;

  if (containerId) {
    const dockerService = new DockerService();
    commandService = new SandboxCommandService(dockerService, containerId);
    gitService = new GitService(dockerService, containerId);
  } else {
    commandService = new CommandService(workspace);
    gitService = null;
  }

  // Type-safe instantiation: ToolExecutor expects CommandService specifically
  // For sandbox, we use CommandService wrapper instead
  const toolExecutor = new ToolExecutor(
    fileService,
    containerId ? new CommandService(workspace) : (commandService as CommandService),
    gitService || undefined
  );

  const projectTree = await workspace.getProjectTree();

  // Resolve agent's system prompt
  const resolved = await resolveAgent(agentType);
  const fallbackAgent = (await getActiveCustomAgents())[0];
  const systemPrompt = resolved?.systemPrompt ?? `You are the ${agentName} agent (${agentType}).`;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildUserPrompt(taskDescription, projectTree) },
  ];

  const thoughts: string[] = [];
  let totalTokens = 0;
  const MAX_ITERATIONS = 40; // Increased for pre-analysis + main loop
  let modelUsed = modelOverride || 'meta-llama/llama-3.3-70b-instruct:free';

  // Track sub-agents spawned in this task
  const spawnedSubAgents: SubAgent[] = [];
  // Track clarification requests
  const raisedClarifications: ClarificationRequest[] = [];
  // Track if this task needs to spawn specialized agents
  const spawnRequests: Array<{ agentType: string; title: string; description: string }> = [];

  // ─── PHASE 1: Pre-Task Analysis (Check for unclear requirements before starting) ───
  emitSSE(sessionId, {
    type: 'agent_thinking',
    agentType,
    agentName,
    message: 'Phase 1: Analyzing task requirements before starting...',
  });

  // Check if predecessor task needs to be completed first
  if (predecessorTaskStatus && predecessorTaskStatus !== 'done') {
    // Request clarification waiting for predecessor
    const clarification = await requestClarification(
      sessionId,
      taskId,
      agentType,
      agentName,
      `Waiting for prerequisite task to complete. Current status: ${predecessorTaskStatus}. Cannot proceed until the predecessor task is approved and done.`,
      `Task requires predecessor to be completed first.`,
      null,
      signal
    );
    raisedClarifications.push(clarification);
    const userResponse = '[User clarification response received]';
    messages.push({
      role: 'user',
      content: `PREDECESSOR STATUS UPDATE:\nUser responded with clarification.\n\nContinue with the task.`,
    });
  }

  // Pre-task analysis step - agent checks if it has enough info
  const preAnalysisResult = await routeModelCall(modelUsed, [
    ...messages,
    { role: 'user', content: `ANALYZE THIS TASK BEFORE STARTING:\n\n${buildPreAnalysisPrompt(taskDescription)}` },
  ], 2048, signal);

  totalTokens += preAnalysisResult.tokensUsed;

  // Check if the agent requested clarification during pre-analysis
  const preAnalysisClarification = parseClarificationRequest(preAnalysisResult.content || '');
  if (preAnalysisClarification) {
    emitSSE(sessionId, {
      type: 'agent_thinking',
      agentType,
      agentName,
      message: 'Pre-task analysis identified a need for clarification. Requesting...',
    });

    const clarification = await requestClarification(
      sessionId,
      taskId,
      agentType,
      agentName,
      preAnalysisClarification.question,
      preAnalysisClarification.context,
      preAnalysisClarification.options,
      signal
    );
    raisedClarifications.push(clarification);
    const userResponse = '[User clarification response received]';
    messages.push({
      role: 'user',
      content: `CLARIFICATION RECEIVED:\nUser responded with new information.\n\nNow proceed with analyzing and executing the task.`,
    });
  }

  // Check if pre-analysis identified need for specialized agent
  const specializationNeed = parseSpecializationNeed(preAnalysisResult.content || '');
  if (specializationNeed) {
    emitSSE(sessionId, {
      type: 'specialized_agent_spawned',
      taskId,
      agentType: specializationNeed.agentType,
      agentName: specializationNeed.agentName,
      description: specializationNeed.description,
    });
    spawnRequests.push({
      agentType: specializationNeed.agentType,
      title: specializationNeed.agentName,
      description: specializationNeed.description,
    });
  }

  // ─── PHASE 2: Main Execution Loop ───
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) throw new Error('Aborted');

    emitSSE(sessionId, {
      type: 'agent_thinking',
      agentType,
      agentName,
      message: `Step ${i + 1}: Thinking...`,
    });

    const result = await routeModelCall(modelUsed, messages, 4096, signal);
    totalTokens += result.tokensUsed;

    const content = result.content || '';
    const thoughtText = content.replace(/\{"tool":\s*".+?",\s*"args":\s*\{.*?\}\}/gs, '').trim();
    if (thoughtText) thoughts.push(thoughtText);

    // Parse tool call from content
    let toolCall: { tool: string; args: any } | null = null;
    try {
      const jsonMatch = content.match(/\{"tool":\s*".+?",\s*"args":\s*\{.*?\}\}/s);
      if (jsonMatch) {
        toolCall = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Not a valid tool call JSON
    }

    if (toolCall) {
      emitSSE(sessionId, {
        type: 'agent_tool_use',
        taskId,
        agentType,
        toolName: toolCall.tool,
        toolArgs: toolCall.args,
        iteration: i + 1,
      });

      const stepId = uuidv4();
      const startTime = Date.now();

      // ─── Handle special tools ─────────────────────────────────────────

      if (toolCall.tool === 'spawn_sub_agent') {
        const subAgentPlans = Array.isArray(toolCall.args?.plans) ? toolCall.args.plans : [toolCall.args];
        const completedSubAgents = await executeSubAgents(
          sessionId,
          taskId,
          workspaceDir,
          signal,
          taskDescription,
          subAgentPlans,
          containerId
        );
        spawnedSubAgents.push(...completedSubAgents);

        // Aggregate sub-agent results
        const subAgentSummary = completedSubAgents
          .map((sa) => `### ${sa.title} (${sa.sub_agent_type})\n${sa.output ?? 'No output'}`)
          .join('\n\n');

        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: `SUB-AGENTS COMPLETED:\n${subAgentSummary}\n\nContinue with the next steps.`,
        });

        const duration = Date.now() - startTime;
        await queries.createAgentStep({
          id: stepId,
          task_id: taskId,
          step_number: i + 1,
          tool_name: 'spawn_sub_agent',
          tool_args: { plans: subAgentPlans },
          tool_output: subAgentSummary,
          tokens_used: result.tokensUsed,
          duration_ms: duration,
          created_at: startTime,
        });

        emitSSE(sessionId, {
          type: 'agent_tool_result',
          taskId,
          agentType,
          toolName: 'spawn_sub_agent',
          output: `Completed ${completedSubAgents.length} sub-agent(s)`,
          success: true,
        });

        continue;
      }

      if (toolCall.tool === 'request_clarification') {
        const question = toolCall.args?.question ?? 'Unclear requirement';
        const context = toolCall.args?.context ?? null;
        const options: string[] | null = Array.isArray(toolCall.args?.options) ? toolCall.args.options : null;

        const clarification = await requestClarification(
          sessionId,
          taskId,
          agentType,
          agentName,
          question,
          context,
          options,
          signal
        );
        raisedClarifications.push(clarification);

        const userResponse = '[User clarification response received]';

        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: `CLARIFICATION RECEIVED:\nUser responded with clarification.\n\nContinue working on the task with this new information.`,
        });

        const duration = Date.now() - startTime;
        await queries.createAgentStep({
          id: stepId,
          task_id: taskId,
          step_number: i + 1,
          tool_name: 'request_clarification',
          tool_args: { question, context, options },
          tool_output: `User response: ${userResponse}`,
          tokens_used: result.tokensUsed,
          duration_ms: duration,
          created_at: startTime,
        });

        continue;
      }

      if (toolCall.tool === 'request_approval') {
        await setTaskNeedsApproval(sessionId, taskId);

        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: `WORK SUBMITTED FOR APPROVAL.\nThe task is now waiting for user (navdeep) review and approval. Once approved, continue with the next steps. If changes are requested, apply them.`,
        });

        const duration = Date.now() - startTime;
        await queries.createAgentStep({
          id: stepId,
          task_id: taskId,
          step_number: i + 1,
          tool_name: 'request_approval',
          tool_args: toolCall.args,
          tool_output: 'Task submitted for approval',
          tokens_used: result.tokensUsed,
          duration_ms: duration,
          created_at: startTime,
        });

        // Wait for approval
        const approvalResult = await waitForApproval(sessionId, taskId, signal);
        messages.push({
          role: 'user',
          content: `APPROVAL RESULT: ${approvalResult.approved ? 'APPROVED' : 'CHANGES REQUESTED'}\n${approvalResult.feedback}\n\n${approvalResult.approved ? 'Proceed with next steps.' : 'Apply the requested changes and resubmit for approval.'}`,
        });

        // Emit approval response event to frontend
        emitSSE(sessionId, {
          type: 'approval_response',
          taskId,
          approved: approvalResult.approved,
          feedback: approvalResult.feedback,
        });

        continue;
      }

      // Handle spawn_specialized_agent (new tool for Manager + specialized delegation)
      if (toolCall.tool === 'spawn_specialized_agent') {
        const { agent_type, title, description, sub_agents } = toolCall.args;

        // Create the custom agent dynamically
        try {
          const createdAgent = await createDynamicCustomAgent(
            agent_type,
            title,
            description,
            `Expert in ${agent_type.replace(/_/g, ' ')}`
          );

          emitSSE(sessionId, {
            type: 'specialized_agent_spawned',
            taskId,
            agentType: agent_type,
            agentName: title,
            description: description,
          });

          spawnRequests.push({ agentType: agent_type, title, description });

          const duration = Date.now() - startTime;
          await queries.createAgentStep({
            id: stepId,
            task_id: taskId,
            step_number: i + 1,
            tool_name: 'spawn_specialized_agent',
            tool_args: { agent_type, title, description, sub_agents },
            tool_output: `Specialized agent '${agent_type}' (ID: ${createdAgent.id}) created and registered for: ${title}`,
            tokens_used: result.tokensUsed,
            duration_ms: duration,
            created_at: startTime,
          });

          messages.push({ role: 'assistant', content });
          messages.push({
            role: 'user',
            content: `SPECIALIZED AGENT CREATED AND REGISTERED:\nA specialized agent '${agent_type}' (${title}) has been created and registered in the system.\nDescription: ${description}\nAgent ID: ${createdAgent.id}\n\nThis agent will be dispatched to handle specialized tasks. Continue with your current work.`,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          messages.push({ role: 'assistant', content });
          messages.push({
            role: 'user',
            content: `ERROR CREATING SPECIALIZED AGENT:\nFailed to create specialized agent '${agent_type}': ${errorMsg}\n\nTry a different approach or request clarification.`,
          });
        }

        continue;
      }

      // Standard tool execution via ToolExecutor
      let toolResult;
      try {
        toolResult = await toolExecutor.execute(toolCall.tool, toolCall.args);
      } catch (err) {
        toolResult = {
          output: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
          success: false,
        };
      }

      // Emit file_changed event for file operations
      if (['write_file', 'delete_file'].includes(toolCall.tool) && toolResult.success) {
        emitSSE(sessionId, {
          type: 'file_changed',
          sessionId,
          taskId,
          filePath: toolCall.args.path || toolCall.args,
          changeType: toolCall.tool === 'write_file' ? 'created' : 'deleted',
        });
      }

      const duration = Date.now() - startTime;
      await queries.createAgentStep({
        id: stepId,
        task_id: taskId,
        step_number: i + 1,
        tool_name: toolCall.tool,
        tool_args: toolCall.args,
        tool_output: toolResult.output,
        tokens_used: result.tokensUsed,
        duration_ms: duration,
        created_at: startTime,
      });

      emitSSE(sessionId, {
        type: 'agent_tool_result',
        taskId,
        agentType,
        toolName: toolCall.tool,
        output: toolResult.output.substring(0, 500) + (toolResult.output.length > 500 ? '...' : ''),
        success: toolResult.success,
      });

      if (toolCall.tool === 'task_complete') {
        return {
          content: toolCall.args.summary || content,
          tokensUsed: totalTokens,
          modelUsed,
          status: 'done',
          subAgents: spawnedSubAgents,
          clarifications: raisedClarifications,
          spawnRequests,
          thought: thoughts.join('\n\n---\n\n'),
        };
      }

      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content: `TOOL RESULT (${toolCall.tool}):\n${toolResult.output}`,
      });
    } else {
      // No tool call - final answer or direct response
      if (thoughtText) thoughts.push(thoughtText);
      
      if (i > 0) {
        return {
          content,
          tokensUsed: totalTokens,
          modelUsed,
          subAgents: spawnedSubAgents,
          clarifications: raisedClarifications,
          spawnRequests,
          thought: thoughts.join('\n\n---\n\n'),
        };
      }
      return {
        content,
        tokensUsed: totalTokens,
        modelUsed,
        subAgents: spawnedSubAgents,
        clarifications: raisedClarifications,
        spawnRequests,
        thought: thoughts.join('\n\n---\n\n'),
      };
    }
  }

  throw new Error(`Agent ${agentName} exceeded max iterations (${MAX_ITERATIONS})`);
}

// ─── Approval Waiting Logic ──────────────────────────────────────────────────

async function waitForApproval(
  sessionId: string,
  taskId: string,
  signal: AbortSignal
): Promise<{ approved: boolean; feedback: string }> {
  const timeoutMs = 30 * 60 * 1000; // 30 minutes
  const startTime = Date.now();

  while (!signal.aborted) {
    if (Date.now() - startTime > timeoutMs) {
      return { approved: false, feedback: 'Approval timed out after 30 minutes. Please review the work when available.' };
    }

    const task = await queries.getTaskById(taskId);
    if (task) {
      // Check if status was changed to 'done' (approved) or 'failed' (rejected)
      if (task.status === 'done') {
        return { approved: true, feedback: 'Approved by navdeep.' };
      }
      if (task.status === 'failed') {
        const comments = await queries.getCommentsByTaskId(taskId);
        const latestFeedback = comments
          .filter((c) => c.agent_type === 'navdeep')
          .sort((a, b) => b.created_at - a.created_at)[0];
        return {
          approved: false,
          feedback: latestFeedback ? latestFeedback.content : 'Changes requested by navdeep.',
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 3000)); // Poll every 3 seconds
  }

  throw new Error('Aborted while waiting for approval');
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildPreAnalysisPrompt(taskDescription: string): string {
  return `Before you start working on this task, analyze it carefully and answer these questions:

1. **Clarity Check**: Is the task description clear and unambiguous? Are there any requirements that are vague or could be interpreted multiple ways?
2. **Missing Information**: Do you have ALL the information you need to complete this task? If not, what is missing?
3. **Dependency Check**: Does this task depend on other tasks being completed first? If so, what are they and what is their status?
4. **Specialization Need**: Does this task require a very specialized skill set that goes beyond your normal capabilities? If so, what kind of specialized agent would be needed?
5. **Scope Assessment**: Is the scope well-defined? Is it too large (should be broken into smaller tasks) or too small?

If you identify ANY issues with clarity, missing information, or dependencies, use request_clarification and mention @navdeep BEFORE starting work.

If you identify a need for a specialized agent that doesn't exist in the team, mention it and use spawn_specialized_agent.

Respond with a structured analysis. Be specific about what you need clarified. Use @navdeep for notifications.`;
}

interface ParsedClarification {
  question: string;
  context: string | null;
  options: string[] | null;
}

function parseClarificationRequest(content: string): ParsedClarification | null {
  // Look for clarification markers in the LLM output
  const questionMatch = content.match(/clarification_needed:\s*(.+?)(?:\n|$)/i);
  if (questionMatch) {
    const question = questionMatch[1].trim();
    const context = content.match(/context:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() || null;
    const optionsMatch = content.match(/options:\s*\[([^\]]+)\]/i);
    const options = optionsMatch
      ? optionsMatch[1].split(',').map((o: string) => o.trim().replace(/['"]/g, ''))
      : null;
    return { question, context, options };
  }
  return null;
}

interface SpecializationNeed {
  agentType: string;
  agentName: string;
  description: string;
}

function parseSpecializationNeed(content: string): SpecializationNeed | null {
  // Look for specialization need markers in the LLM output
  const typeMatch = content.match(/specialized_agent_type:\s*(\w+)/i);
  const nameMatch = content.match(/specialized_agent_name:\s*(.+?)(?:\n|$)/i);
  const descMatch = content.match(/specialized_agent_description:\s*(.+?)(?:\n|$)/i);

  if (typeMatch && nameMatch) {
    return {
      agentType: typeMatch[1].trim(),
      agentName: nameMatch[1].trim(),
      description: descMatch ? descMatch[1].trim() : 'Specialized agent created for specific task requirements',
    };
  }
  return null;
}

function buildUserPrompt(taskDescription: string, projectTree: string): string {
  return `${taskDescription}

## Workspace Structure
${projectTree}

## Available Tools
${JSON.stringify(AGENT_TOOLS, null, 2)}

To use a tool, respond with a JSON object in the format:
{"tool": "tool_name", "args": {"arg1": "val1"}}

Wait for the tool result before proceeding.
When you are finished, use the 'task_complete' tool with a summary.
If you need clarification, use 'request_clarification' and mention @navdeep.
If you need work approved, use 'request_approval' and mention @navdeep.
If you have sub-tasks that can run in parallel, use 'spawn_sub_agent'.
If the task requires a specialized agent type that doesn't exist in the team, use 'spawn_specialized_agent' to create and delegate to a new specialized agent.
`;
}