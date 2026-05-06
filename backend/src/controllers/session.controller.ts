import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  getAllSessions,
  getSessionById,
  getTasksBySessionId,
  getCommentsBySessionId,
  getChatMessagesBySessionId,
} from '../db/queries';
import { startSession, cancelSession } from '../orchestrator/orchestrator';

const createSessionSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(2000),
  projectId: z.string().uuid().optional(),
  workspaceDir: z.string().optional(),
  agentOverrides: z.record(z.string(), z.object({
    modelId: z.string().optional(),
    name: z.string().optional(),
  })).optional(),
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

    const [tasks, comments, chatMessages] = await Promise.all([
      getTasksBySessionId(session.id),
      getCommentsBySessionId(session.id),
      getChatMessagesBySessionId(session.id),
    ]);
    res.json({ session: { ...session, tasks }, comments, chatMessages });
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
