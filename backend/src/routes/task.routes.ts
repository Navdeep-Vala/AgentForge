import { Router } from 'express';
import { getTaskHandler, addTaskCommentHandler } from '../controllers/task.controller';

const router = Router();

router.get('/:id', getTaskHandler);
router.post('/:id/comments', addTaskCommentHandler);

export default router;
