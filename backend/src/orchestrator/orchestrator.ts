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
  updateSessionContainerId,
  getChildTasks,
  getTaskById,
} from '../db/queries';
import { emitSSE, closeSseConnection } from '../controllers/sse.controller';
import { startHeartbeatJob, stopHeartbeatJob, triggerImmediateHeartbeat } from './heartbeat.service';
import { DockerService } from '../sandbox/docker.service';
import { WorkspaceProvisioner } from '../workspace/workspace.provisioner';
import { Session, Task, CustomAgent, AgentOverride, TaskStatus } from '../types';

const managerAgent = new ManagerAgent();
const abortControllers = new Map<string, AbortController>();

// ─── Session goal cache (needed by heartbeat dispatcher) ──────────────────────
const sessionGoals = new Map<string, string>();

function dispatchSpawnedTask(sessionId: string, workspaceDir: string | undefined, signal: AbortSignal, containerId: string | null, agentOverrides?: Record<string, AgentOverride>) {
  return (task: Task): void => {
    runTask(task, sessionId, workspaceDir, signal, agentOverrides, containerId || undefined).catch((err) =>
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

  // NEW: Docker container provisioning
  let containerId: string | null = null;
  const dockerService = new DockerService();
  const provisioner = new WorkspaceProvisioner(dockerService);

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
            parts.push(`[Repository Context:]\n${project.repo_context.slice(0, 50_000)}`);
          }
          enrichedGoal = `${parts.join('\n')}\n\n---\nGoal: ${goal}`;
        }
      } catch (err: any) {
        // best-effort — proceed with original goal if project fetch fails
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[Orchestrator] Failed to enrich goal with project context: ${errMsg}`);
      }
    }
    sessionGoals.set(sessionId, enrichedGoal);

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
        thought: plan.thought || null,
        tokens_used: 0,
        model_used: null,
        spawned_by_agent: null,
        started_at: null,
        completed_at: null,
        created_at: createdAt,
        parent_task_id: null,
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

    // NEW: Provision Docker workspace if projectId or workspaceDir is provided
    if (workspaceDir || projectId) {
const effectiveWorkspaceDir = workspaceDir || `/workspaces/${sessionId}`;
    const project = projectId ? await getProjectById(projectId) : null;

    try {
        containerId = await provisioner.provisionWorkspace(
          sessionId,
          effectiveWorkspaceDir,
          project?.repo_url || undefined,
          'main' // could be configurable
        );
        // Save container ID to session
        await updateSessionContainerId(sessionId, containerId);
      } catch (err) {
        console.error(`[Orchestrator] Failed to provision workspace:`, err);
        await updateSessionStatus(sessionId, 'cancelled', Date.now());
        emitSSE(sessionId, {
          type: 'error',
          taskId: '',
          message: `Failed to provision workspace: ${err instanceof Error ? err.message : err}`,
        });
        closeSseConnection(sessionId);
        abortControllers.delete(sessionId);
        sessionGoals.delete(sessionId);
        return;
      }
    }

    // Start scheduled heartbeat
    startHeartbeatJob(
      sessionId,
      enrichedGoal,
      session.heartbeat_interval_minutes,
      dispatchSpawnedTask(sessionId, workspaceDir, signal, containerId, agentOverrides),
      agentOverrides
    );

    // Run all initial tasks in parallel
    const taskPromises = taskRecords.map((task) => runTask(task, sessionId, workspaceDir || undefined, signal, agentOverrides, containerId || undefined));
    const results = await Promise.allSettled(taskPromises);

    // Check if any tasks need approval before synthesis
    const needsApproval = (await getTasksBySessionId(sessionId)).some(
      (t) => t.status === 'needs_approval'
    );

    if (needsApproval) {
      emitSSE(sessionId, {
        type: 'manager_working',
        message: 'Waiting for approval on submitted code before synthesizing report...',
      });
    }

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
    // NEW: Cleanup Docker container on session end
    if (containerId) {
      try {
        await dockerService.destroySandbox(containerId);
        // Optional: delete workspace directory if configured not to persist
        if (workspaceDir && process.env.SANDBOX_PERSIST_WORKSPACE !== 'true') {
          const { rm } = await import('fs/promises');
          await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to destroy sandbox:', err);
      }
    }
    
    abortControllers.delete(sessionId);
    sessionGoals.delete(sessionId);
  }
}

// ─── Run a single task ────────────────────────────────────────────────────────

async function runTask(
  task: Task,
  sessionId: string,
  workspaceDir: string | undefined,
  signal: AbortSignal,
  agentOverrides?: Record<string, AgentOverride>,
  containerId?: string
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

  // ─── Check if this task has a predecessor that must be approved first ───
  // This enforces the rule that the tester must wait for the coder's approval
  const predecessorStatus = await checkPredecessorTaskStatus(task, sessionId);
  if (predecessorStatus !== null && predecessorStatus !== 'done') {
    // Task cannot start yet - mark as waiting
    await updateTaskStatus(task.id, 'waiting_for_predecessor', startedAt);
    emitSSE(sessionId, {
      type: 'manager_working',
      message: `Task "${task.title}" is waiting for predecessor task to be approved before proceeding.`,
    });

    // Wait for predecessor to be approved
    const predApproved = await waitForPredecessorApproval(task, sessionId, signal);
    if (!predApproved) {
      // Predecessor was rejected or session aborted
      await updateTaskStatus(task.id, 'failed', startedAt);
      emitSSE(sessionId, {
        type: 'task_failed',
        taskId: task.id,
        error: 'Predecessor task was rejected. This task cannot proceed.',
      });
      return;
    }

    // Re-check status - it should be 'done' now
    const updatedStatus = await checkPredecessorTaskStatus(task, sessionId);
    if (updatedStatus !== 'done') {
      await updateTaskStatus(task.id, 'failed', startedAt);
      emitSSE(sessionId, {
        type: 'task_failed',
        taskId: task.id,
        error: `Predecessor task status is '${updatedStatus}', expected 'done'.`,
      });
      return;
    }

    // Now proceed with the task
    await updateTaskStatus(task.id, 'in_progress', Date.now());
    emitSSE(sessionId, {
      type: 'task_claimed',
      taskId: task.id,
      agentName: task.agent_name,
      agentType: task.agent_type,
      started_at: Date.now(),
    });
  }

  try {
    const result = await executeAgentTask(
      task.agent_type,
      task.description,
      sessionId,
      task.id,
      workspaceDir,
      signal,
      agentOverrides?.[task.agent_type]?.modelId,
      containerId
    );

    const completedAt = Date.now();
    const finalStatus: TaskStatus = result.status ?? 'done';

    await updateTaskComplete(task.id, finalStatus, result.content, result.tokensUsed, result.modelUsed, completedAt, result.thought || task.thought);
    await incrementSessionTokens(sessionId, result.tokensUsed, Date.now());

    const completedTask: Task = {
      ...task,
      status: finalStatus,
      output: result.content,
      tokens_used: result.tokensUsed,
      model_used: result.modelUsed,
      started_at: startedAt,
      completed_at: completedAt,
    };

    // Emit all sub-agent events
    if (result.subAgents && result.subAgents.length > 0) {
      for (const subAgent of result.subAgents) {
        emitSSE(sessionId, {
          type: subAgent.status === 'completed' ? 'sub_agent_complete' : 'sub_agent_failed',
          taskId: task.id,
          subAgentId: subAgent.id,
          subAgentType: subAgent.sub_agent_type,
          title: subAgent.title,
          output: subAgent.output || undefined,
        });
      }
    }

    // Handle spawn requests for specialized agents
    if (result.spawnRequests && result.spawnRequests.length > 0) {
      for (const spawnReq of result.spawnRequests) {
        const spawnedTask: Task = {
          id: `${task.id}-spawned-${spawnReq.agentType}-${Date.now()}`,
          session_id: sessionId,
          agent_type: spawnReq.agentType,
          agent_name: spawnReq.title,
          title: spawnReq.title,
          description: spawnReq.description,
          status: 'in_progress',
          output: null,
          thought: null,
          tokens_used: 0,
          model_used: null,
          spawned_by_agent: task.agent_type,
          started_at: Date.now(),
          completed_at: null,
          created_at: Date.now(),
          parent_task_id: task.id,
        };

        await createTask(spawnedTask);
        emitSSE(sessionId, {
          type: 'task_created',
          task: {
            id: spawnedTask.id,
            status: 'in_progress',
            agent_type: spawnedTask.agent_type,
            agent_name: spawnedTask.agent_name,
            title: spawnedTask.title,
            description: spawnedTask.description,
            spawned_by_agent: spawnedTask.spawned_by_agent,
            created_at: spawnedTask.created_at,
          },
        });

        // Dispatch the spawned specialized agent
        dispatchSpawnedTask(sessionId, workspaceDir || undefined, signal, containerId || null, agentOverrides)(spawnedTask);
      }
    }

    // Emit all clarification response events
    if (result.clarifications && result.clarifications.length > 0) {
      for (const cl of result.clarifications) {
        emitSSE(sessionId, {
          type: 'clarification_response',
          requestId: cl.id,
          taskId: task.id,
          response: cl.answer || '[No answer recorded]',
        });
      }
    }

    const statusLabel = finalStatus === 'needs_approval' ? 'submitted for approval' : 'done';

    emitSSE(sessionId, {
      type: 'task_complete',
      task: {
        id: task.id,
        status: finalStatus,
        output: result.content,
        thought: result.thought || task.thought,
        tokens_used: result.tokensUsed,
        model_used: result.modelUsed,
        completed_at: completedAt,
      },
    });
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

// ─── Predecessor Task Dependency Check ────────────────────────────────────
// Ensures the tester waits for the coder task to be approved before starting

async function checkPredecessorTaskStatus(task: Task, sessionId: string): Promise<TaskStatus | null> {
  // Define which task types depend on which predecessor tasks
  // The tester depends on the coder's task being approved first
  const predecessorMap: Record<string, string> = {
    tester: 'coder',
    test_runner: 'coder',
    security_auditor: 'coder',
    deployment: 'tester',
    deployer: 'tester',
  };

  const predecessorType = predecessorMap[task.agent_type];
  if (!predecessorType) return null; // No predecessor required

  const tasks = await getTasksBySessionId(sessionId);
  const predecessorTask = tasks.find((t) => t.agent_type === predecessorType);

  if (!predecessorTask) return null; // No predecessor task found yet, will be created later

  return predecessorTask.status as TaskStatus;
}

async function waitForPredecessorApproval(task: Task, sessionId: string, signal: AbortSignal): Promise<boolean> {
  const timeoutMs = 30 * 60 * 1000; // 30 minutes max wait
  const startTime = Date.now();
  const pollInterval = 5000; // Check every 5 seconds

  emitSSE(sessionId, {
    type: 'manager_working',
    message: `Waiting for prerequisite task approval before starting "${task.title}"...`,
  });

  while (!signal.aborted) {
    if (Date.now() - startTime > timeoutMs) {
      emitSSE(sessionId, {
        type: 'manager_working',
        message: `Timeout waiting for prerequisite task. Proceeding anyway for "${task.title}".`,
      });
      return false;
    }

    const tasks = await getTasksBySessionId(sessionId);
    const predecessorMap: Record<string, string> = {
      tester: 'coder',
      test_runner: 'coder',
      security_auditor: 'coder',
    };

    const predecessorType = predecessorMap[task.agent_type];
    const predecessorTask = tasks.find((t) => t.agent_type === predecessorType);

    if (predecessorTask && predecessorTask.status === 'done') {
      emitSSE(sessionId, {
        type: 'manager_working',
        message: `Prerequisite coder task approved. Starting "${task.title}" now.`,
      });
      return true;
    }

    // If predecessor was rejected, abort
    if (predecessorTask && predecessorTask.status === 'failed') {
      emitSSE(sessionId, {
        type: 'manager_working',
        message: `Prerequisite coder task was rejected. Cannot start "${task.title}".`,
      });
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return false;
}
