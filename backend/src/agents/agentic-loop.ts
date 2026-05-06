import { WorkspaceManager } from '../workspace/workspace.manager';
import { FileService } from '../workspace/file.service';
import { CommandService } from '../workspace/command.service';
import { ToolExecutor } from '../workspace/tool-executor';
import { AGENT_TOOLS } from '../workspace/tools';
import { routeModelCall } from '../services/model-router.service';
import { OpenRouterMessage, OpenRouterCallResult } from '../types';
import { emitSSE } from '../controllers/sse.controller';
import { v4 as uuidv4 } from 'uuid';
import * as queries from '../db/queries';

export interface AgentTaskResult {
  content: string;
  tokensUsed: number;
  modelUsed: string;
}

export async function executeAgenticTask(
  sessionId: string,
  taskId: string,
  agentType: string,
  agentName: string,
  taskDescription: string,
  workspaceDir: string,
  signal: AbortSignal,
  modelOverride?: string
): Promise<AgentTaskResult> {
  const workspace = new WorkspaceManager(workspaceDir);
  const fileService = new FileService(workspace);
  const commandService = new CommandService(workspace);
  const toolExecutor = new ToolExecutor(fileService, commandService);

  const projectTree = await workspace.getProjectTree();
  
  // Base system prompt from registry (we'll need a way to get it)
  // For now, let's assume we pass the system prompt or fetch it
  // I'll need to modify agent.registry to export the system prompt building logic
  
  // Placeholder system prompt
  let systemPrompt = `You are the ${agentName} agent (${agentType}). 
You have access to tools to interact with the user's codebase.
Always use tools to explore, read, and modify files when necessary.

## Tools
You can call the following tools:
${JSON.stringify(AGENT_TOOLS, null, 2)}

To use a tool, respond with a JSON object in the format:
{"tool": "tool_name", "args": {"arg1": "val1"}}

Wait for the tool result before proceeding.
When you are finished, use the 'task_complete' tool with a summary.

## Workspace Structure
${projectTree}
`;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: taskDescription },
  ];

  let totalTokens = 0;
  const MAX_ITERATIONS = 20;
  let modelUsed = modelOverride || 'meta-llama/llama-3.3-70b-instruct:free'; // Fallback

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
    
    // Parse tool call from content (Prompt-based tool use fallback)
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
      
      const toolResult = await toolExecutor.execute(toolCall.tool, toolCall.args);
      const duration = Date.now() - startTime;

      // Save step to DB
      await queries.createAgentStep({
        id: stepId,
        task_id: taskId,
        step_number: i + 1,
        tool_name: toolCall.tool,
        tool_args: toolCall.args,
        tool_output: toolResult.output,
        tokens_used: result.tokensUsed, // Approximating per-step tokens
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
        };
      }

      // Add tool result to history
      messages.push({ role: 'assistant', content });
      messages.push({ 
        role: 'user', 
        content: `TOOL RESULT (${toolCall.tool}):\n${toolResult.output}` 
      });

    } else {
      // If no tool call and it's not the first iteration, assume it's the final answer
      if (i > 0) {
        return {
          content,
          tokensUsed: totalTokens,
          modelUsed,
        };
      }
      // If it's the first iteration and no tool call, maybe it just wants to answer directly
      // But we should encourage tool use. For now, return it.
      return {
        content,
        tokensUsed: totalTokens,
        modelUsed,
      };
    }
  }

  throw new Error(`Agent ${agentName} exceeded max iterations (${MAX_ITERATIONS})`);
}
