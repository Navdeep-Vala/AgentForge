import axios from 'axios';
import { env } from '../config/env';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export class WebSearchService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = env.SERPER_API_KEY;
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY is not configured. Please add it to your .env file.');
    }

    try {
      const response = await axios.post(
        'https://google.serper.dev/search',
        {
          q: query,
          num: limit,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const results = response.data.organic || [];
      return results.map((r: any) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        position: r.position,
      }));
    } catch (err) {
      console.error('[WebSearch] Error performing search:', err);
      throw new Error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
