import { Router } from 'express';
import {
  listModelsHandler,
  saveApiKeyHandler,
  testApiKeyHandler,
  deleteApiKeyHandler,
} from '../controllers/model.controller';

const router = Router();

router.get('/', listModelsHandler);
router.post('/keys', saveApiKeyHandler);
router.post('/keys/test', testApiKeyHandler);
router.delete('/keys/:provider', deleteApiKeyHandler);

export default router;
