import { callOpenRouter } from '../services/openrouter.service';
import { OpenRouterCallResult } from '../types';

export abstract class BaseAgent {
  abstract readonly type: string;
  abstract readonly name: string;
  abstract readonly systemPrompt: string;
  abstract readonly model: string;
  abstract readonly color: string;
  abstract readonly icon: string;

  async execute(
    taskDescription: string,
    signal?: AbortSignal
  ): Promise<OpenRouterCallResult> {
    return callOpenRouter(
      this.model,
      [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: taskDescription },
      ],
      4096,
      signal
    );
  }
}
