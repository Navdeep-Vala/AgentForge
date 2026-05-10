import { Request, Response } from 'express';
import { standupService } from '../services/standup.service';

export class StandupController {
  public static async getLatestStandup(req: Request, res: Response) {
    try {
      const standup = await standupService.getLatestStandup();
      res.json(standup);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getStandupHistory(req: Request, res: Response) {
    try {
      const history = await standupService.getStandupHistory();
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async triggerStandup(req: Request, res: Response) {
    try {
      await standupService.generateDailyStandup();
      res.json({ message: 'Standup generation triggered' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
