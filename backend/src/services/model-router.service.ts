import { OpenRouterMessage, OpenRouterCallResult } from '../types';
import { callOpenRouter } from './openrouter.service';
import { getModelConfig } from '../db/queries';

// ─── BYOK Provider Routing ────────────────────────────────────────────────────
// Model string conventions:
//   deepseek/...:free       → OpenRouter (free)
//   meta-llama/...:free     → OpenRouter (free)
//   google/...:free         → OpenRouter (free)
//   mistralai/...:free      → OpenRouter (free)
//   openai/<model>          → BYOK OpenAI
//   anthropic/<model>       → BYOK Anthropic
//   google/<model>          → BYOK Google (no :free suffix)
//   groq/<model>            → BYOK Groq
//   <anything else>         → OpenRouter (paid, uses OpenRouter credits)

function detectProvider(model: string): 'openrouter' | 'openai' | 'anthropic' | 'google' | 'groq' {
  if (model.includes(':free')) return 'openrouter';
  if (model.startsWith('openai/')) return 'openai';
  if (model.startsWith('anthropic/')) return 'anthropic';
  if (model.startsWith('groq/')) return 'groq';
  if (model.startsWith('google/')) return 'google';
  return 'openrouter';
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  maxTokens: number,
  signal?: AbortSignal
): Promise<OpenRouterCallResult> {
  const modelId = model.replace(/^openai\//, '');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens }),
    signal: signal as RequestInit['signal'],
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
  };
  return {
    content: data.choices[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  maxTokens: number,
  signal?: AbortSignal
): Promise<OpenRouterCallResult> {
  const modelId = model.replace(/^anthropic\//, '');
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
  const userMessages = messages.filter((m) => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      system: systemMsg,
      messages: userMessages,
      max_tokens: maxTokens,
    }),
    signal: signal as RequestInit['signal'],
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };
  return {
    content: data.content[0]?.text ?? '',
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
}

async function callGoogle(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  maxTokens: number,
  signal?: AbortSignal
): Promise<OpenRouterCallResult> {
  const modelId = model.replace(/^google\//, '');
  const systemMsg = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg }] };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal as RequestInit['signal'],
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google API error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    usageMetadata: { totalTokenCount: number };
  };
  return {
    content: data.candidates[0]?.content?.parts[0]?.text ?? '',
    tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
  };
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  maxTokens: number,
  signal?: AbortSignal
): Promise<OpenRouterCallResult> {
  const modelId = model.replace(/^groq\//, '');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens }),
    signal: signal as RequestInit['signal'],
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
  };
  return {
    content: data.choices[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function routeModelCall(
  model: string,
  messages: OpenRouterMessage[],
  maxTokens: number,
  signal?: AbortSignal
): Promise<OpenRouterCallResult> {
  const provider = detectProvider(model);

  if (provider === 'openrouter') {
    return callOpenRouter(model, messages, maxTokens, signal);
  }

  const config = await getModelConfig(provider);
  if (!config?.api_key_encrypted) {
    throw new Error(
      `No API key configured for provider "${provider}". Add it in Settings → API Keys.`
    );
  }

  // Keys are stored encrypted; decrypt before use
  const { decrypt } = await import('./crypto.service');
  const apiKey = decrypt(config.api_key_encrypted);

  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model, messages, maxTokens, signal);
    case 'anthropic':
      return callAnthropic(apiKey, model, messages, maxTokens, signal);
    case 'google':
      return callGoogle(apiKey, model, messages, maxTokens, signal);
    case 'groq':
      return callGroq(apiKey, model, messages, maxTokens, signal);
  }
}
