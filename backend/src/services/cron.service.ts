import cron, { ScheduledTask } from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCronJobs, updateCronJobLastRun } from '../db/queries';
import { startSession } from '../orchestrator/orchestrator';
import { CronJob } from '../types';

export class CronService {
  private static instance: CronService;
  private activeJobs: Map<string, ScheduledTask> = new Map();

  private constructor() {}

  public static getInstance(): CronService {
    if (!CronService.instance) {
      CronService.instance = new CronService();
    }
    return CronService.instance;
  }

  /**
   * Load all active cron jobs from DB and schedule them.
   */
  public async initialize(): Promise<void> {
    console.log('[CronService] Initializing scheduled tasks...');
    const jobs = await getActiveCronJobs();
    
    for (const job of jobs) {
      this.scheduleJob(job);
    }
    
    console.log(`[CronService] Scheduled ${jobs.length} active tasks.`);
  }

  /**
   * Schedule a single job.
   */
  public scheduleJob(job: CronJob): void {
    if (this.activeJobs.has(job.id)) {
      this.activeJobs.get(job.id)?.stop();
    }

    const task = cron.schedule(job.cron_expression, async () => {
      console.log(`[CronService] Firing job: ${job.name}`);
      
      const sessionId = uuidv4();
      try {
        // Update last run time
        await updateCronJobLastRun(job.id, Date.now());
        
        // Start a new isolated session for the cron task
        await startSession(
          sessionId, 
          job.message, 
          undefined, 
          undefined, 
          undefined, 
          'isolated'
        );
      } catch (err) {
        console.error(`[CronService] Job ${job.name} (${job.id}) failed to start session:`, err);
      }
    });

    this.activeJobs.set(job.id, task);
    console.log(`[CronService] Job scheduled: ${job.name} (${job.cron_expression})`);
  }

  /**
   * Stop and remove a scheduled job.
   */
  public stopJob(jobId: string): void {
    const task = this.activeJobs.get(jobId);
    if (task) {
      task.stop();
      this.activeJobs.delete(jobId);
      console.log(`[CronService] Job stopped: ${jobId}`);
    }
  }

  /**
   * Restart all jobs (useful after bulk updates).
   */
  public async reload(): Promise<void> {
    for (const [id, task] of this.activeJobs.entries()) {
      task.stop();
    }
    this.activeJobs.clear();
    await this.initialize();
  }
}

export const cronService = CronService.getInstance();
