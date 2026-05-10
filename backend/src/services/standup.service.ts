import { v4 as uuidv4 } from 'uuid';
import * as queries from '../db/queries';
import { routeModelCall } from './model-router.service';

export class StandupService {
  private static instance: StandupService;

  private constructor() {}

  public static getInstance(): StandupService {
    if (!StandupService.instance) {
      StandupService.instance = new StandupService();
    }
    return StandupService.instance;
  }

  /**
   * Generate the daily standup by aggregating activity from the last 24 hours.
   */
  public async generateDailyStandup(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already generated for today
    const existing = await queries.getStandupByDate(today);
    if (existing) return;

    // 1. Gather data from the last 24 hours
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    
    const tasks = await queries.getTasksUpdatedSince(yesterday);
    const activities = await queries.getActivitiesSince(yesterday);
    const comments = await queries.getCommentsSince(yesterday);

    // 2. Prepare context for the LLM
    const context = {
      completed: tasks.filter(t => t.status === 'done'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      blocked: tasks.filter(t => t.status === 'blocked' || t.status === 'needs_approval'),
      recent_activities: activities.slice(0, 50),
      recent_comments: comments.slice(0, 50)
    };

    const prompt = `You are the Lead Manager. Generate a "Daily Standup" report based on the following activity from the last 24 hours.
    
DATA:
${JSON.stringify(context, null, 2)}

FORMAT:
📊 DAILY STANDUP — ${today}

✅ COMPLETED TODAY
• [Agent Name]: [Task Title] ([Brief Outcome])
...

🔄 IN PROGRESS
• [Agent Name]: [Task Title] ([Current Step])
...

🚫 BLOCKED
• [Agent Name]: [Reason for being blocked]
...

📝 KEY DECISIONS & INSIGHTS
• [Bullet point summary of important decisions or findings]

Keep it concise, professional, and actionable.`;

    // 3. Call LLM to summarize
    const result = await routeModelCall('meta-llama/llama-3.3-70b-instruct:free', [
      { role: 'system', content: 'You are an expert project manager.' },
      { role: 'user', content: prompt }
    ], 4096);

    const content = result.content || 'Failed to generate standup.';

    // 4. Persist to DB
    await queries.createStandup({
      id: uuidv4(),
      date_str: today,
      content,
      created_at: Date.now()
    });

    console.log(`[StandupService] Generated daily standup for ${today}`);
  }

  public async getLatestStandup(): Promise<any> {
    return await queries.getLatestStandup();
  }

  public async getStandupHistory(): Promise<any[]> {
    return await queries.getStandupHistory();
  }
}

export const standupService = StandupService.getInstance();
