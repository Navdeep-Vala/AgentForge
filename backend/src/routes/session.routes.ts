import { Router } from 'express';
import {
  createSessionHandler,
  listSessionsHandler,
  getSessionHandler,
  cancelSessionHandler,
  addSessionChatMessageHandler,
  downloadWorkspaceFileHandler,
} from '../controllers/session.controller';

const router = Router();

router.post('/', createSessionHandler);
router.get('/', listSessionsHandler);
router.get('/:id', getSessionHandler);
router.post('/:id/chat', addSessionChatMessageHandler);
router.delete('/:id/cancel', cancelSessionHandler);
router.get(/^\/([^/]+)\/workspace\/(.+)$/, downloadWorkspaceFileHandler);

export default router;
