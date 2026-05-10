import fs from 'fs';
import path from 'path';
import readline from 'readline';

export interface HistoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
  timestamp: number;
}

export class HistoryService {
  private baseDir: string;

  constructor(baseDir: string = './history') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(sessionKey: string): string {
    // Sanitize sessionKey for file name
    const fileName = sessionKey.replace(/:/g, '_') + '.jsonl';
    return path.join(this.baseDir, fileName);
  }

  /**
   * Append a message to the session's history file.
   */
  public async appendMessage(sessionKey: string, message: Omit<HistoryMessage, 'timestamp'>): Promise<void> {
    const filePath = this.getFilePath(sessionKey);
    const historyMessage: HistoryMessage = {
      ...message,
      timestamp: Date.now(),
    };
    
    const line = JSON.stringify(historyMessage) + '\n';
    await fs.promises.appendFile(filePath, line, 'utf8');
  }

  /**
   * Load the full conversation history for a session.
   */
  public async loadHistory(sessionKey: string): Promise<HistoryMessage[]> {
    const filePath = this.getFilePath(sessionKey);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const messages: HistoryMessage[] = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        messages.push(JSON.parse(line));
      }
    }

    return messages;
  }

  /**
   * Clear history for a session.
   */
  public async clearHistory(sessionKey: string): Promise<void> {
    const filePath = this.getFilePath(sessionKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }
}

export const historyService = new HistoryService();
