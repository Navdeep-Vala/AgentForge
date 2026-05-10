import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getTaskById, createTaskComment, getCommentsByTaskId, getSubAgentsByTaskId, getClarificationRequestsBySessionId, getChildTasks, updateTaskStatus as updateTaskStatusQuery } from '../db/queries';
import { emitSSE } from './sse.controller';
import { CommentType, TaskComment } from '../types';

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
    const [comments, subAgents, clarificationRequests, childTasks] = await Promise.all([
      getCommentsByTaskId(task.id),
      getSubAgentsByTaskId(task.id),
      getClarificationRequestsBySessionId(task.session_id),
      getChildTasks(task.id),
    ]);
    res.json({ task, comments, subAgents, clarificationRequests, childTasks });
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

    const comment: TaskComment = {
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

export async function approveTaskHandler(
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

    const { approved, feedback } = req.body as { approved?: boolean; feedback?: string };

    if (approved) {
      await updateTaskStatusQuery(task.id, 'done');
    } else {
      await updateTaskStatusQuery(task.id, 'failed');
    }

    // Add a comment with the approval/rejection feedback
    if (feedback) {
      const comment: TaskComment = {
        id: uuidv4(),
        task_id: task.id,
        session_id: task.session_id,
        agent_type: 'navdeep',
        agent_name: 'Navdeep',
        content: approved
          ? `✅ Approved: ${feedback}`
          : `❌ Changes Requested: ${feedback}`,
        comment_type: (approved ? 'praise' : 'review') as CommentType,
        tokens_used: 0,
        created_at: Date.now(),
      };
      await createTaskComment(comment);
      emitSSE(task.session_id, { type: 'task_comment', taskId: task.id, comment });
    }

    emitSSE(task.session_id, {
      type: 'agent_thinking',
      agentType: task.agent_type,
      agentName: task.agent_name,
      message: approved ? 'Task approved by navdeep. Continuing...' : `Task rejected by navdeep. Revising: ${feedback}`,
    });

    res.status(200).json({ success: true, approved });
  } catch (err) {
    next(err);
  }
}
