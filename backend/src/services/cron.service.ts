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
    
    // Ensure default heartbeats for built-in agents exist
    await this.ensureDefaultHeartbeats();

    const jobs = await getActiveCronJobs();
    
    for (const job of jobs) {
      this.scheduleJob(job);
    }
    
    console.log(`[CronService] Scheduled ${jobs.length} active tasks.`);
  }

  /**
   * Create staggered heartbeats for built-in agents if they don't exist in the DB.
   */
  private async ensureDefaultHeartbeats(): Promise<void> {
    const defaultJobs = [
      { name: 'manager-heartbeat', cron: '0,15,30,45 * * * *', type: 'manager', role: 'Lead Orchestrator' },
      { name: 'researcher-heartbeat', cron: '2,17,32,47 * * * *', type: 'researcher', role: 'Technical Researcher' },
      { name: 'coder-heartbeat', cron: '4,19,34,49 * * * *', type: 'coder', role: 'Software Engineer' },
      { name: 'tester-heartbeat', cron: '6,21,36,51 * * * *', type: 'tester', role: 'QA Engineer' },
      { name: 'rnd-heartbeat', cron: '8,23,38,53 * * * *', type: 'rnd', role: 'R&D Specialist' },
      { name: 'daily-standup', cron: '0 18 * * *', type: 'manager', role: 'Lead Manager' },
    ];

    const existingJobs = await getActiveCronJobs();
    const existingNames = new Set(existingJobs.map(j => j.name));

    for (const def of defaultJobs) {
      if (!existingNames.has(def.name)) {
        const job: CronJob = {
          id: uuidv4(),
          name: def.name,
          cron_expression: def.cron,
          message: `You are the ${def.role}. Check Mission Control for new tasks or updates to existing projects. Summarize your status.`,
          agent_type: def.type,
          is_active: true,
          last_run: null,
          created_at: Date.now(),
          updated_at: Date.now()
        };
        const { createCronJob } = await import('../db/queries');
        await createCronJob(job);
        console.log(`[CronService] Created default heartbeat: ${def.name}`);
      }
    }
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

        if (job.name === 'daily-standup') {
          const { standupService } = await import('./standup.service');
          await standupService.generateDailyStandup();
          return;
        }
        
        // Start a new isolated session for the cron task
        await startSession(
          sessionId, 
          job.message, 
          undefined, 
          undefined, 
          undefined, 
          'isolated',
          job.agent_type
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
