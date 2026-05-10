import { Router } from 'express';
import { StandupController } from '../controllers/standup.controller';

const router = Router();

router.get('/latest', StandupController.getLatestStandup);
router.get('/history', StandupController.getStandupHistory);
router.post('/trigger', StandupController.triggerStandup);

export default router;
