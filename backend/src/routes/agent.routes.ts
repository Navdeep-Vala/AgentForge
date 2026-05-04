import { Router } from 'express';
import {
  listAgentsHandler,
  createAgentHandler,
  updateAgentHandler,
  deleteAgentHandler,
} from '../controllers/agent.controller';

const router = Router();

router.get('/', listAgentsHandler);
router.post('/', createAgentHandler);
router.put('/:id', updateAgentHandler);
router.delete('/:id', deleteAgentHandler);

export default router;
