import { Router } from 'express';
import sessionRoutes from './session.routes';
import agentRoutes from './agent.routes';
import sseRoutes from './sse.routes';
import taskRoutes from './task.routes';
import modelRoutes from './model.routes';
import projectRoutes from './project.routes';

const router = Router();

router.use('/projects', projectRoutes);
router.use('/sessions', sessionRoutes);
router.use('/agents', agentRoutes);
router.use('/sse', sseRoutes);
router.use('/tasks', taskRoutes);
router.use('/models', modelRoutes);

export default router;
