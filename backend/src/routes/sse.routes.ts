import { Router } from 'express';
import { sseHandler } from '../controllers/sse.controller';

const router = Router();

router.get('/:sessionId', sseHandler);

export default router;
