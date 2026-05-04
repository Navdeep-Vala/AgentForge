import cron, { ScheduledTask } from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import {
  getTasksBySessionId,
  getRecentChatMessages,
  getRecentDoneTasksBySession,
  createTaskComment,
  createChatMessage,
  createTask,
  getAutoSpawnedTaskCount,
  updateChatMessageSpawnedTask,
} from '../db/queries';
import { getBuiltInAgentDefinitions, getActiveAgentDescriptions, getAgentDisplayInfo, getActiveCustomAgents } from '../agents/agent.registry';
import {
  generateTaskCommentary,
  generateChatContribution,
  generateTaskSpawnPlan,
  buildTaskSummary,
} from '../agents/heartbeat.agent';
import { emitSSE } from '../controllers/sse.controller';
import { Task, ChatMessage, CustomAgent } from '../types';

type HeartbeatDispatcher = (task: Task) => void;

const scheduledJobs = new Map<string, ScheduledTask>();

// ─── Immediate heartbeat after task_complete ───────────────────────────────────

export async function triggerImmediateHeartbeat(
  sessionId: string,
  completedTask: Task,
  dispatchNewTask: HeartbeatDispatcher,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) return;

  const builtInAgents = getBuiltInAgentDefinitions();
  const customAgents = await getActiveCustomAgents();
  const customAgentMap = new Map<string, CustomAgent>(customAgents.map((a) => [a.type, a]));

  const allAgentTypes = [
    ...builtInAgents.map((a) => ({ type: a.type, name: a.name, systemPrompt: a.systemPrompt, model: a.model })),
    ...customAgents.map((a) => ({ type: a.type, name: a.name, systemPrompt: a.system_prompt, model: a.model })),
  ];

  // All agents EXCEPT the one who completed the task
  const otherAgents = allAgentTypes.filter((a) => a.type !== completedTask.agent_type);

  await Promise.allSettled(
    otherAgents.map(async (agent) => {
      if (signal?.aborted) return;
      if (!completedTask.output) return;

      const commentary = await generateTaskCommentary(
        agent.name,
        agent.systemPrompt,
        agent.model,
        completedTask.agent_name,
        completedTask.title,
        completedTask.output,
        signal
      );

      if (!commentary) return;

      const comment = {
        id: uuidv4(),
        task_id: completedTask.id,
        session_id: sessionId,
        agent_type: agent.type,
        agent_name: agent.name,
        content: commentary.content,
        comment_type: commentary.comment_type,
        tokens_used: commentary.tokensUsed,
        created_at: Date.now(),
      };

      await createTaskComment(comment);
      emitSSE(sessionId, { type: 'task_comment', taskId: completedTask.id, comment });
    })
  );
}

// ─── Scheduled heartbeat (chat contributions + task spawning) ──────────────────

async function runScheduledHeartbeat(sessionId: string, sessionGoal: string, dispatchNewTask: HeartbeatDispatcher): Promise<void> {
  const windowMs = Date.now() - 30 * 60 * 1000; // last 30 minutes
  const recentTasks = await getRecentDoneTasksBySession(sessionId, windowMs);
  const recentChat = await getRecentChatMessages(sessionId, windowMs);
  const taskSummary = buildTaskSummary(recentTasks);

  const builtInAgents = getBuiltInAgentDefinitions();
  const customAgents = await getActiveCustomAgents();

  const allAgents = [
    ...builtInAgents.map((a) => ({ type: a.type, name: a.name, systemPrompt: a.systemPrompt, model: a.model })),
    ...customAgents.map((a) => ({ type: a.type, name: a.name, systemPrompt: a.system_prompt, model: a.model })),
  ];

  const newChatMessages: ChatMessage[] = [];

  // Phase 1: Each agent contributes to chat
  await Promise.allSettled(
    allAgents.map(async (agent) => {
      const contribution = await generateChatContribution(
        agent.name,
        agent.systemPrompt,
        agent.model,
        sessionGoal,
        taskSummary,
        recentChat
      );

      if (!contribution) return;

      const msg: ChatMessage = {
        id: uuidv4(),
        session_id: sessionId,
        agent_type: agent.type,
        agent_name: agent.name,
        content: contribution.content,
        spawns_task: false,
        spawned_task_id: null,
        created_at: Date.now(),
      };

      await createChatMessage(msg);
      emitSSE(sessionId, { type: 'chat_message', message: msg });
      newChatMessages.push(msg);
    })
  );

  // Phase 2: Jarvis checks if any chat message warrants a new task
  const autoSpawnedCount = await getAutoSpawnedTaskCount(sessionId);
  if (autoSpawnedCount >= env.MAX_AUTO_SPAWNED_TASKS) return;

  const allTasks = await getTasksBySessionId(sessionId);
  const existingTitles = allTasks.map((t) => t.title);
  const agentList = await getActiveAgentDescriptions();

  const managerDef = getBuiltInAgentDefinitions().find((a) => a.type === 'manager');
  if (!managerDef) return;

  const allRecentChat = [...recentChat, ...newChatMessages];
  const spawnPlans = await generateTaskSpawnPlan(
    env.MANAGER_MODEL,
    sessionGoal,
    agentList,
    existingTitles,
    allRecentChat
  );

  for (const plan of spawnPlans) {
    const currentCount = await getAutoSpawnedTaskCount(sessionId);
    if (currentCount >= env.MAX_AUTO_SPAWNED_TASKS) break;

    const customAgentMap = new Map<string, CustomAgent>(customAgents.map((a) => [a.type, a]));
    const displayInfo = getAgentDisplayInfo(plan.agent_type, customAgentMap);

    const spawnedTask: Task = {
      id: uuidv4(),
      session_id: sessionId,
      agent_type: plan.agent_type,
      agent_name: displayInfo.name,
      title: plan.title,
      description: plan.description,
      status: 'todo',
      output: null,
      tokens_used: 0,
      model_used: null,
      spawned_by_agent: plan.spawned_by,
      started_at: null,
      completed_at: null,
      created_at: Date.now(),
    };

    await createTask(spawnedTask);

    // Link the chat message that triggered this task
    const triggerMsg = newChatMessages.find((m) => m.agent_type === plan.spawned_by);
    if (triggerMsg) {
      await updateChatMessageSpawnedTask(triggerMsg.id, spawnedTask.id);
    }

    emitSSE(sessionId, {
      type: 'task_created',
      task: {
        id: spawnedTask.id,
        status: 'todo',
        agent_type: spawnedTask.agent_type,
        agent_name: spawnedTask.agent_name,
        title: spawnedTask.title,
        description: spawnedTask.description,
        spawned_by_agent: spawnedTask.spawned_by_agent,
        created_at: spawnedTask.created_at,
      },
    });

    dispatchNewTask(spawnedTask);
  }
}

// ─── Lifecycle: start / stop ──────────────────────────────────────────────────

export function startHeartbeatJob(
  sessionId: string,
  sessionGoal: string,
  intervalMinutes: number,
  dispatchNewTask: HeartbeatDispatcher
): void {
  const cronExpr = `*/${intervalMinutes} * * * *`;

  const job = cron.schedule(cronExpr, () => {
    runScheduledHeartbeat(sessionId, sessionGoal, dispatchNewTask).catch((err) =>
      console.error(`[Heartbeat] Session ${sessionId} scheduled tick error:`, err)
    );
  });

  scheduledJobs.set(sessionId, job);
  console.log(`[Heartbeat] Started for session ${sessionId} — every ${intervalMinutes}m`);
}

export function stopHeartbeatJob(sessionId: string): void {
  const job = scheduledJobs.get(sessionId);
  if (job) {
    job.stop();
    scheduledJobs.delete(sessionId);
    console.log(`[Heartbeat] Stopped for session ${sessionId}`);
  }
}
