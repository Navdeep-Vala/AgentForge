import { getGatewayConfig, GatewayConfig } from '../config/gatewayConfig';
import { startSession, cancelSession } from '../orchestrator/orchestrator';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import * as path from 'path';
import { cronService } from '../services/cron.service';
import { homeWorkspaceService } from '../services/home-workspace.service';

export interface ChannelMessage {
  channelId: string;
  senderId: string;
  text: string;
  reply: (text: string) => Promise<void>;
}

export class Gateway {
  private static instance: Gateway;
  private config: GatewayConfig;
  private wss: WebSocketServer | null = null;
  private activeChannels: Map<string, any> = new Map();
  private sessionChannelMap: Map<string, string> = new Map(); // sessionId -> channelId

  private constructor() {
    this.config = getGatewayConfig();
  }

  public static getInstance(): Gateway {
    if (!Gateway.instance) {
      Gateway.instance = new Gateway();
    }
    return Gateway.instance;
  }

  private async initializeServices() {
    try {
      await homeWorkspaceService.initialize();
      await cronService.initialize();
      console.log('[Gateway] Core services initialized (HomeWorkspace, Cron, etc.)');
    } catch (err) {
      console.error('[Gateway] Failed to initialize services:', err);
    }
  }

  public async initialize(server?: Server): Promise<void> {
    console.log(`[Gateway] Initializing ${this.config.gateway.name}...`);
    
    await this.initializeServices();

    if (server) {
      this.wss = new WebSocketServer({ server, path: '/control' });
      this.setupWebSocket();
    }
    
    if (this.config.channels.telegram?.enabled) {
      await this.initTelegramChannel();
    }
    
    if (this.config.channels.discord?.enabled) {
      await this.initDiscordChannel();
    }
    
    console.log('[Gateway] Initialization complete.');
  }

  private setupWebSocket(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[Gateway] Control client connected via WebSocket');

      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data);
          console.log('[Gateway] Received control command:', message);
          
          switch (message.type) {
            case 'start_session':
              const sessionId = uuidv4();
              ws.send(JSON.stringify({ type: 'session_starting', sessionId }));
              await startSession(sessionId, message.goal);
              break;
            case 'cancel_session':
              await cancelSession(message.sessionId);
              ws.send(JSON.stringify({ type: 'session_cancelled', sessionId: message.sessionId }));
              break;
            default:
              ws.send(JSON.stringify({ type: 'error', message: 'Unknown command' }));
          }
        } catch (err: any) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      });
    });
  }

  private async initTelegramChannel(): Promise<void> {
    console.log('[Gateway] Telegram channel integration placeholder...');
    // In a real implementation, we would initialize the Telegram bot here
  }

  private async initDiscordChannel(): Promise<void> {
    console.log('[Gateway] Discord channel integration placeholder...');
    // In a real implementation, we would initialize the Discord bot here
  }

  /**
   * Route a message from a channel to a session or start a new one
   */
  public async handleMessage(message: ChannelMessage): Promise<void> {
    const { text, senderId, channelId } = message;

    // Command pattern: /<agent_type> <message>
    const match = text.match(/^\/([a-zA-Z0-9_-]+)\s+(.*)/);
    if (match) {
      const agentType = match[1].toLowerCase();
      const goal = match[2];
      
      const sessionId = uuidv4();
      this.sessionChannelMap.set(sessionId, channelId);
      await message.reply(`Routing to ${agentType}...`);
      
      // Start/Resume the session for this agent
      startSession(sessionId, goal, undefined, undefined, undefined, 'main', agentType).catch(async (err) => {
        await message.reply(`Error routing to ${agentType}: ${err.message}`);
      });
      return;
    }

    if (text.startsWith('/start')) {
      const goal = text.replace('/start', '').trim();
      if (!goal) {
        await message.reply('Please provide a goal. Usage: /start <goal>');
        return;
      }
      
      const sessionId = uuidv4();
      this.sessionChannelMap.set(sessionId, channelId);
      await message.reply(`Starting manager session...`);
      
      startSession(sessionId, goal, undefined, undefined, undefined, 'main', 'manager').catch(async (err) => {
        await message.reply(`Error starting session: ${err.message}`);
      });
      return;
    }

    if (text.startsWith('/stop')) {
      const sessionId = this.getSessionForChannel(channelId);
      if (!sessionId) {
        await message.reply('No active session found for this channel.');
        return;
      }
      
      await cancelSession(sessionId);
      this.sessionChannelMap.delete(sessionId);
      await message.reply(`Session ${sessionId} cancelled.`);
      return;
    }

    const sessionId = this.getSessionForChannel(channelId);
    if (!sessionId) {
      await message.reply('No active session. Use /start <goal> to begin.');
      return;
    }

    // Handle regular message as input to the session (e.g. clarification response)
    // This would need a way to feed input back into the orchestrator
    console.log(`[Gateway] Received message for session ${sessionId}: ${text}`);
  }

  private getSessionForChannel(channelId: string): string | undefined {
    for (const [sessionId, cId] of this.sessionChannelMap.entries()) {
      if (cId === channelId) return sessionId;
    }
    return undefined;
  }
}

export const gateway = Gateway.getInstance();
