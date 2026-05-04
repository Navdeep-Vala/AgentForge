import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getTaskById, createTaskComment, getCommentsByTaskId } from '../db/queries';
import { emitSSE } from './sse.controller';
import { CommentType } from '../types';

const commentSchema = z.object({
  agent_type: z.string().min(1),
  agent_name: z.string().min(1),
  content: z.string().min(1),
  comment_type: z.enum(['insight', 'review', 'refute', 'praise', 'question']).default('insight'),
});

export async function getTaskHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const task = await getTaskById(id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const comments = await getCommentsByTaskId(task.id);
    res.json({ task, comments });
  } catch (err) {
    next(err);
  }
}

export async function addTaskCommentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const task = await getTaskById(id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const comment = {
      id: uuidv4(),
      task_id: task.id,
      session_id: task.session_id,
      agent_type: parsed.data.agent_type,
      agent_name: parsed.data.agent_name,
      content: parsed.data.content,
      comment_type: parsed.data.comment_type as CommentType,
      tokens_used: 0,
      created_at: Date.now(),
    };

    await createTaskComment(comment);
    emitSSE(task.session_id, { type: 'task_comment', taskId: task.id, comment });

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}
