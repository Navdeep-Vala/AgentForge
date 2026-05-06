import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { ManagerAgent } from '../agents/manager.agent';
import {
  executeAgentTask,
  getActiveAgentDescriptions,
  getAgentDisplayInfo,
  getActiveCustomAgents,
} from '../agents/agent.registry';
import {
  createSession,
  createTask,
  updateSessionStatus,
  updateSessionFinalReport,
  updateTaskStatus,
  updateTaskComplete,
  cancelSessionTasks,
  getTasksBySessionId,
  incrementSessionTokens,
  getProjectById,
} from '../db/queries';
import { emitSSE, closeSseConnection } from '../controllers/sse.controller';
import { startHeartbeatJob, stopHeartbeatJob, triggerImmediateHeartbeat } from './heartbeat.service';
import { Session, Task, CustomAgent, AgentOverride } from '../types';

const managerAgent = new ManagerAgent();
const abortControllers = new Map<string, AbortController>();

// ─── Session goal cache (needed by heartbeat dispatcher) ──────────────────────
const sessionGoals = new Map<string, string>();

function dispatchSpawnedTask(sessionId: string, signal: AbortSignal, agentOverrides?: Record<string, AgentOverride>) {
  return (task: Task): void => {
    runTask(task, sessionId, signal, agentOverrides).catch((err) =>
      console.error(`[Orchestrator] Spawned task ${task.id} error:`, err)
    );
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function startSession(
  sessionId: string,
  goal: string,
  projectId?: string,
  workspaceDir?: string,
  agentOverrides?: Record<string, AgentOverride>
): Promise<void> {
  const controller = new AbortController();
  abortControllers.set(sessionId, controller);
  sessionGoals.set(sessionId, goal);
  const { signal } = controller;

  const now = Date.now();
  const session: Session = {
    id: sessionId,
    project_id: projectId || null,
    goal,
    status: 'pending',
    workspace_dir: workspaceDir || null,
    final_report: null,
    total_tokens_used: 0,
    estimated_cost_usd: 0,
    heartbeat_interval_minutes: env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES,
    created_at: now,
    updated_at: now,
  };

  try {
    await createSession(session);

    // Inject project context into goal for LLM calls (best-effort)
    let enrichedGoal = goal;
    if (projectId) {
      try {
        const project = await getProjectById(projectId);
        if (project) {
          const parts: string[] = [`[Project: ${project.name}]`];
          if (project.description) parts.push(`[Description: ${project.description}]`);
          if (project.repo_context) {
            parts.push(`\n${project.repo_context.slice(0, 50_000)}`);
          }
          enrichedGoal = `${parts.join('\n')}\n\n---\nGoal: ${goal}`;
        }
      } catch {
        // best-effort — proceed with original goal if project fetch fails
      }
    }

    const agentDescriptions = await getActiveAgentDescriptions();

    let plan;
    try {
      emitSSE(sessionId, { type: 'manager_working', message: 'Decomposing goal into actionable tasks...' });
      plan = await managerAgent.decompose(enrichedGoal, agentDescriptions, signal, agentOverrides?.manager?.modelId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateSessionStatus(sessionId, 'cancelled', Date.now());
      emitSSE(sessionId, { type: 'error', taskId: '', message });
      closeSseConnection(sessionId);
      abortControllers.delete(sessionId);
      sessionGoals.delete(sessionId);
      return;
    }

    if (!plan.tasks || plan.tasks.length === 0) {
      await updateSessionStatus(sessionId, 'cancelled', Date.now());
      emitSSE(sessionId, {
        type: 'error',
        taskId: '',
        message: 'Jarvis could not plan this goal. Try rephrasing.',
      });
      closeSseConnection(sessionId);
      abortControllers.delete(sessionId);
      sessionGoals.delete(sessionId);
      return;
    }

    const customAgents = await getActiveCustomAgents();
    const customAgentMap = new Map<string, CustomAgent>(customAgents.map((a) => [a.type, a]));

    const taskRecords: Task[] = plan.tasks.map((pt) => {
      const displayInfo = getAgentDisplayInfo(pt.agent_type, customAgentMap, agentOverrides);
      const createdAt = Date.now();
      return {
        id: uuidv4(),
        session_id: sessionId,
        agent_type: pt.agent_type,
        agent_name: displayInfo.name,
        title: pt.title,
        description: pt.description,
        status: 'todo' as const,
        output: null,
        tokens_used: 0,
        model_used: null,
        spawned_by_agent: null,
        started_at: null,
        completed_at: null,
        created_at: createdAt,
      };
    });

    for (const task of taskRecords) {
      await createTask(task);
    }

    await updateSessionStatus(sessionId, 'running', Date.now());
    emitSSE(sessionId, { type: 'session_status_changed', status: 'running' });

    // Emit task_created for each initial task
    for (const task of taskRecords) {
      emitSSE(sessionId, {
        type: 'task_created',
        task: {
          id: task.id,
          status: 'todo',
          agent_type: task.agent_type,
          agent_name: task.agent_name,
          title: task.title,
          description: task.description,
          spawned_by_agent: null,
          created_at: task.created_at,
        },
      });
    }

    // Start scheduled heartbeat
    startHeartbeatJob(
      sessionId,
      goal,
      session.heartbeat_interval_minutes,
      dispatchSpawnedTask(sessionId, signal, agentOverrides),
      agentOverrides
    );

    // Run all initial tasks in parallel
    const taskPromises = taskRecords.map((task) => runTask(task, sessionId, workspaceDir, signal, agentOverrides));
    await Promise.allSettled(taskPromises);

    if (signal.aborted) {
      stopHeartbeatJob(sessionId);
      abortControllers.delete(sessionId);
      sessionGoals.delete(sessionId);
      return;
    }

    stopHeartbeatJob(sessionId);

    const completedTasks = await getTasksBySessionId(sessionId);
    const taskOutputs = completedTasks
      .filter((t) => t.status === 'done')
      .map((t) => ({ title: t.title, agentName: t.agent_name, output: t.output }));

    if (taskOutputs.length === 0) {
      await updateSessionStatus(sessionId, 'completed', Date.now());
      emitSSE(sessionId, {
        type: 'error',
        taskId: '',
        message: 'All tasks failed. No output to synthesize.',
      });
      closeSseConnection(sessionId);
      abortControllers.delete(sessionId);
      sessionGoals.delete(sessionId);
      return;
    }

    let finalReport: string;
    try {
      emitSSE(sessionId, { type: 'manager_working', message: 'Synthesizing final report...' });
      finalReport = await managerAgent.synthesize(goal, taskOutputs, signal, agentOverrides?.manager?.modelId);
    } catch (err) {
      finalReport = `## Final Report\n\n_Synthesis failed: ${err instanceof Error ? err.message : String(err)}_\n\n${taskOutputs.map((t) => `### ${t.title}\n${t.output}`).join('\n\n')}`;
    }

    // Calculate totals from DB
    const allTasks = await getTasksBySessionId(sessionId);
    const totalTokens = allTasks.reduce((sum, t) => sum + (t.tokens_used ?? 0), 0);

    await updateSessionFinalReport(sessionId, finalReport, 'completed', totalTokens, 0, Date.now());

    emitSSE(sessionId, {
      type: 'session_complete',
      final_report: finalReport,
      total_tokens: totalTokens,
      cost_usd: 0,
    });

    setTimeout(() => closeSseConnection(sessionId), 5000);
  } catch (err) {
    console.error(`[Orchestrator] Session ${sessionId} error:`, err);
    stopHeartbeatJob(sessionId);
    await updateSessionStatus(sessionId, 'cancelled', Date.now()).catch(() => undefined);
    emitSSE(sessionId, {
      type: 'error',
      taskId: '',
      message: err instanceof Error ? err.message : 'Unexpected orchestrator error',
    });
    closeSseConnection(sessionId);
  } finally {
    abortControllers.delete(sessionId);
    sessionGoals.delete(sessionId);
  }
}

// ─── Run a single task ────────────────────────────────────────────────────────

async function runTask(
  task: Task,
  sessionId: string,
  workspaceDir: string | undefined | null,
  signal: AbortSignal,
  agentOverrides?: Record<string, AgentOverride>
): Promise<void> {
  const startedAt = Date.now();
  await updateTaskStatus(task.id, 'in_progress', startedAt);

  emitSSE(sessionId, {
    type: 'task_claimed',
    taskId: task.id,
    agentName: task.agent_name,
    agentType: task.agent_type,
    started_at: startedAt,
  });

  try {
    const result = await executeAgentTask(
      task.agent_type,
      task.description,
      sessionId,
      task.id,
      workspaceDir,
      signal,
      agentOverrides?.[task.agent_type]?.modelId
    );
    const completedAt = Date.now();

    await updateTaskComplete(task.id, 'done', result.content, result.tokensUsed, result.modelUsed, completedAt);
    await incrementSessionTokens(sessionId, result.tokensUsed, Date.now());

    const completedTask: Task = {
      ...task,
      status: 'done',
      output: result.content,
      tokens_used: result.tokensUsed,
      model_used: result.modelUsed,
      started_at: startedAt,
      completed_at: completedAt,
    };

    emitSSE(sessionId, {
      type: 'task_complete',
      task: {
        id: task.id,
        status: 'done',
        output: result.content,
        tokens_used: result.tokensUsed,
        model_used: result.modelUsed,
        completed_at: completedAt,
      },
    });

    // Immediate heartbeat — all other agents comment on this completed task
    const controller = abortControllers.get(sessionId);
    if (controller && !signal.aborted) {
      triggerImmediateHeartbeat(
        sessionId,
        completedTask,
        dispatchSpawnedTask(sessionId, signal, agentOverrides),
        signal,
        agentOverrides
      ).catch((err) =>
        console.error(`[Orchestrator] Immediate heartbeat error for task ${task.id}:`, err)
      );
    }
  } catch (err) {
    if (signal.aborted) return;

    const errorMsg = err instanceof Error ? err.message : String(err);
    const completedAt = Date.now();

    await updateTaskComplete(task.id, 'failed', `Error: ${errorMsg}`, 0, null, completedAt);

    emitSSE(sessionId, { type: 'task_failed', taskId: task.id, error: errorMsg });
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelSession(sessionId: string): Promise<void> {
  const controller = abortControllers.get(sessionId);
  if (controller) {
    controller.abort();
    abortControllers.delete(sessionId);
  }

  stopHeartbeatJob(sessionId);
  sessionGoals.delete(sessionId);

  await cancelSessionTasks(sessionId);
  await updateSessionStatus(sessionId, 'cancelled', Date.now());
  closeSseConnection(sessionId);
}
