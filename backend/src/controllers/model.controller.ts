import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { upsertModelConfig, getAllModelConfigs, deleteModelConfig } from '../db/queries';
import { encrypt } from '../services/crypto.service';
import { getAvailableFreeModels } from '../services/free-model-pool.service';


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
    const [freeModels, configs] = await Promise.all([getAvailableFreeModels(), getAllModelConfigs()]);
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
