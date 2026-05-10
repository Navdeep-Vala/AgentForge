import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import {
  getAllSessions,
  getSessionById,
  getTasksBySessionId,
  getCommentsBySessionId,
  getChatMessagesBySessionId,
  getSubAgentsBySessionId,
  getClarificationRequestsBySessionId,
  createChatMessage,
} from '../db/queries';
import { startSession, cancelSession } from '../orchestrator/orchestrator';
import { emitSSE } from './sse.controller';

const createSessionSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(2000),
  projectId: z.string().uuid().optional(),
  workspaceDir: z.string().optional(),
  agentOverrides: z.record(z.string(), z.object({
    modelId: z.string().optional(),
    name: z.string().optional(),
  })).optional(),
});

const createChatMessageSchema = z.object({
  agent_type: z.string().min(1),
  agent_name: z.string().min(1),
  content: z.string().min(1).max(10_000),
});

export async function createSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { goal, projectId, workspaceDir, agentOverrides } = parsed.data;
    const sessionId = uuidv4();

    res.status(201).json({ sessionId, status: 'running' });

    startSession(sessionId, goal, projectId, workspaceDir, agentOverrides).catch((err) => {
      console.error('[Session] Background orchestration error:', err);
    });
  } catch (err) {
    next(err);
  }
}

export async function listSessionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const projectId = req.query.projectId as string | undefined;
    const sessions = await getAllSessions(projectId);
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
}

export async function getSessionHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const [tasks, comments, chatMessages, allSubAgents, allClarifications] = await Promise.all([
      getTasksBySessionId(session.id),
      getCommentsBySessionId(session.id),
      getChatMessagesBySessionId(session.id),
      getSubAgentsBySessionId(session.id),
      getClarificationRequestsBySessionId(session.id),
    ]);
    res.json({ session: { ...session, tasks }, comments, chatMessages, subAgents: allSubAgents, clarificationRequests: allClarifications });
  } catch (err) {
    next(err);
  }
}

export async function cancelSessionHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'running' && session.status !== 'pending') {
      res.status(400).json({ error: 'Session is not running' });
      return;
    }

    await cancelSession(session.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function addSessionChatMessageHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const parsed = createChatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const message = {
      id: uuidv4(),
      session_id: session.id,
      agent_type: parsed.data.agent_type,
      agent_name: parsed.data.agent_name,
      content: parsed.data.content,
      spawns_task: false,
      spawned_task_id: null,
      created_at: Date.now(),
    };

    await createChatMessage(message);
    emitSSE(session.id, { type: 'chat_message', message });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function downloadWorkspaceFileHandler(
  req: Request<{ id: string, filepath: string | string[] }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const params = req.params as any;
    const sessionId = params.id || params[0];
    const filepath = params.filepath || params[1];
    
    const session = await getSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const workspaceDir = session.workspace_dir || `/tmp/mission-control/workspaces/${session.id}`;
    const normalizedFilepath = Array.isArray(filepath) ? filepath.join('/') : filepath;
    const filePath = path.join(workspaceDir, normalizedFilepath);
    
    if (!path.normalize(filePath).startsWith(path.normalize(workspaceDir))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    res.download(filePath);
  } catch (err) {
    next(err);
  }
}
