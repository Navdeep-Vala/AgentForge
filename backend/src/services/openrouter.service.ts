import { env } from '../config/env';
import { OpenRouterMessage, OpenRouterCallResult } from '../types';

interface OpenRouterResponseBody {
  choices: Array<{
    message: {
      content: string | null;
      reasoning_content?: string | null; // DeepSeek R1 reasoning field
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    code: number;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callOpenRouter(
  model: string,
  messages: OpenRouterMessage[],
  maxTokens: number = 4096,
  signal?: AbortSignal
): Promise<OpenRouterCallResult> {
  const url = `${env.OPENROUTER_BASE_URL}/chat/completions`;
  let lastError: Error = new Error('OpenRouter call failed after retries');

  for (let attempt = 0; attempt <= env.OPENROUTER_MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new Error('Request aborted by user');
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'AgentForge',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal,
      });

      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1500; // slightly longer backoff
        lastError = new Error(
          `OpenRouter rate limit (429) on model "${model}". Free models have strict limits — wait a moment and retry.`
        );
        console.warn(`[OpenRouter] Rate limited on ${model}. Retrying in ${delay}ms (attempt ${attempt + 1}/${env.OPENROUTER_MAX_RETRIES + 1})`);
        if (attempt < env.OPENROUTER_MAX_RETRIES) {
          await sleep(delay);
        }
        continue;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as Partial<OpenRouterResponseBody>;
        const msg = body.error?.message ?? `HTTP ${response.status}`;
        if (response.status === 401) {
          throw new Error(`Invalid OpenRouter API key. Check OPENROUTER_API_KEY in backend/.env`);
        }
        lastError = new Error(`OpenRouter API error (${response.status}): ${msg}`);
        console.error(`[OpenRouter] Non-retryable error on ${model}: ${lastError.message}`);
        throw lastError;
      }

      const data = (await response.json()) as OpenRouterResponseBody;

      // DeepSeek R1 and other reasoning models may put the answer in reasoning_content
      // when content is null. Fall back to it so the response is never lost.
      const content =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.message?.reasoning_content ||
        null;

      if (!content) {
        // Check if model returned an error inside a 200
        if (data.error?.message) {
          lastError = new Error(`Model error: ${data.error.message}`);
        } else {
          lastError = new Error(
            `Model "${model}" returned empty content. It may be overloaded — try a different free model.`
          );
        }
        console.error(`[OpenRouter] Empty content from ${model}:`, JSON.stringify(data));
        if (attempt < env.OPENROUTER_MAX_RETRIES) {
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        break;
      }

      return {
        content,
        tokensUsed: data.usage?.total_tokens ?? 0,
      };
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'Request aborted by user')) {
        throw new Error('Request aborted by user');
      }
      // Re-throw non-retryable errors (401, etc.)
      if (err instanceof Error && err.message.startsWith('Invalid OpenRouter API key')) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[OpenRouter] Attempt ${attempt + 1} failed for ${model}: ${lastError.message}`);

      if (attempt < env.OPENROUTER_MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
      }
    }
  }

  console.error(`[OpenRouter] All retries exhausted for ${model}. Last error: ${lastError.message}`);
  throw lastError;
}
