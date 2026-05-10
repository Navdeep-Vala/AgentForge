import { v4 as uuidv4 } from 'uuid';
import * as queries from '../db/queries';
import { emitSSE } from '../controllers/sse.controller';

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Process a new comment to handle @mentions and thread subscriptions.
   */
  public async handleNewComment(taskId: string, sessionId: string, senderAgentType: string, content: string): Promise<void> {
    // 1. Extract @mentions
    const mentions = this.extractMentions(content);
    
    // 2. Get existing subscriptions
    const subscriptions = await queries.getTaskSubscriptions(taskId);
    const subscriberTypes = new Set(subscriptions.map(s => s.agent_type));
    
    // 3. Auto-subscribe the sender
    if (!subscriberTypes.has(senderAgentType)) {
      await queries.createTaskSubscription(taskId, senderAgentType);
      subscriberTypes.add(senderAgentType);
    }

    // 4. Create notifications for mentions
    const recipients = new Set<string>();
    
    if (mentions.includes('all')) {
      // Notify all built-in agents (or all active agents)
      const allAgents = ['manager', 'researcher', 'coder', 'tester', 'rnd'];
      allAgents.forEach(a => recipients.add(a));
    } else {
      mentions.forEach(m => recipients.add(m.toLowerCase()));
    }

    // 5. Create notifications for subscribers (Thread Subscriptions)
    subscriberTypes.forEach(s => recipients.add(s));

    // Remove sender from recipients
    recipients.delete(senderAgentType.toLowerCase());

    // 6. Persist notifications
    for (const recipient of recipients) {
      const notification = {
        id: uuidv4(),
        recipient_agent_type: recipient,
        content: `New comment on task ${taskId}: "${content.slice(0, 100)}..."`,
        is_delivered: false,
        created_at: Date.now()
      };
      await queries.createNotification(notification);
      
      // Also emit SSE for real-time UI updates
      emitSSE(sessionId, {
        type: 'notification_created',
        notification: {
          id: notification.id,
          recipient_agent_type: notification.recipient_agent_type,
          content: notification.content,
          created_at: notification.created_at
        }
      });
    }
  }

  /**
   * Fetch and mark as delivered any pending notifications for an agent.
   */
  public async getPendingNotifications(agentType: string): Promise<any[]> {
    const notifications = await queries.getPendingNotificationsForAgent(agentType.toLowerCase());
    if (notifications.length > 0) {
      const ids = notifications.map(n => n.id);
      await queries.markNotificationsAsDelivered(ids);
    }
    return notifications;
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = content.matchAll(mentionRegex);
    return Array.from(matches).map(m => m[1]);
  }
}

export const notificationService = NotificationService.getInstance();
