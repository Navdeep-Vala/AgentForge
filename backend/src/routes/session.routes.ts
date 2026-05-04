import { Router } from 'express';
import {
  createSessionHandler,
  listSessionsHandler,
  getSessionHandler,
  cancelSessionHandler,
} from '../controllers/session.controller';

const router = Router();

router.post('/', createSessionHandler);
router.get('/', listSessionsHandler);
router.get('/:id', getSessionHandler);
router.delete('/:id/cancel', cancelSessionHandler);

export default router;
