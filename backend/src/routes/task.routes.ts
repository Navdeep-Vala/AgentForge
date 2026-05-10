import { Router } from 'express';
import { getTaskHandler, addTaskCommentHandler, approveTaskHandler } from '../controllers/task.controller';

const router = Router();

router.get('/:id', getTaskHandler);
router.post('/:id/comments', addTaskCommentHandler);
router.post('/:id/approve', approveTaskHandler);

export default router;
