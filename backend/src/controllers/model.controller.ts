import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { upsertModelConfig, getAllModelConfigs, deleteModelConfig } from '../db/queries';
import { encrypt } from '../services/crypto.service';
import { FreeModel } from '../types';
import { env } from '../config/env';

// ─── Live free-model cache (5-minute TTL) ─────────────────────────────────────

const FALLBACK_FREE_MODELS: FreeModel[] = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'Meta', best_for: 'Planning, reasoning, manager tasks' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder 480B', provider: 'Qwen', best_for: 'Code generation (best free coding model)' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', provider: 'Google', best_for: 'Research, general tasks' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron Super 120B', provider: 'NVIDIA', best_for: 'Analysis, R&D, reasoning' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B', provider: 'NousResearch', best_for: 'Complex reasoning, large context' },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'Google', best_for: 'Lightweight fallback' },
];

let cachedFreeModels: FreeModel[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getLiveFreeModels(): Promise<FreeModel[]> {
  if (cachedFreeModels && Date.now() < cacheExpiresAt) {
    return cachedFreeModels;
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);

    const data = (await res.json()) as { data: Array<{ id: string; name: string; context_length: number }> };

    const models: FreeModel[] = data.data
      .filter((m) => m.id.endsWith(':free'))
      .map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.id.split('/')[0],
        best_for: '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    cachedFreeModels = models;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return models;
  } catch (err) {
    console.warn('[ModelController] Could not fetch live free models, using fallback:', err);
    return cachedFreeModels ?? FALLBACK_FREE_MODELS;
  }
}

const BYOK_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'anthropic/claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'anthropic' },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
  { id: 'groq/llama3-70b-8192', name: 'Llama3 70B (Groq)', provider: 'groq' },
];

const saveKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'groq']),
  api_key: z.string().min(8),
});

const testKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'groq']),
  api_key: z.string().min(8),
});

export async function listModelsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [freeModels, configs] = await Promise.all([getLiveFreeModels(), getAllModelConfigs()]);
    const configuredProviders = new Set(configs.filter((c) => c.is_active && c.api_key_encrypted).map((c) => c.provider));

    const byok = BYOK_MODELS.map((m) => ({
      ...m,
      configured: configuredProviders.has(m.provider),
    }));

    res.json({ free: freeModels, byok });
  } catch (err) {
    next(err);
  }
}

export async function saveApiKeyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = saveKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { provider, api_key } = parsed.data;
    const encrypted = encrypt(api_key);
    const id = uuidv4();
    await upsertModelConfig(id, provider, encrypted);

    res.json({ success: true, provider, masked: maskKey(api_key) });
  } catch (err) {
    next(err);
  }
}

export async function testApiKeyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = testKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const { provider, api_key } = parsed.data;
    const ok = await verifyKey(provider, api_key);
    res.json({ valid: ok });
  } catch (err) {
    next(err);
  }
}

export async function deleteApiKeyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const provider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
    await deleteModelConfig(provider);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 8)}****` : '****';
}

async function verifyKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    switch (provider) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      }
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        return res.status !== 401 && res.status !== 403;
      }
      case 'google': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        return res.ok;
      }
      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
