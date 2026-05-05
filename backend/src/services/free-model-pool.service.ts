import { env } from '../config/env';
import { FreeModel } from '../types';

// ─── Shared live free-model cache ─────────────────────────────────────────────
// This is the single source of truth for available free models.
// Used by agent.registry, manager.agent, heartbeat, and model.controller.

const FALLBACK_FREE_MODELS: FreeModel[] = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'Meta', best_for: 'Planning, reasoning' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', provider: 'Qwen', best_for: 'Code generation' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', provider: 'Google', best_for: 'Research, general' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron Super 120B', provider: 'NVIDIA', best_for: 'Analysis, R&D' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B', provider: 'NousResearch', best_for: 'Complex reasoning' },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'Google', best_for: 'Lightweight fallback' },
];

let cachedFreeModels: FreeModel[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetches all available free models from OpenRouter and caches them (5-min TTL).
 * Falls back to a hardcoded list if the API is unreachable.
 */
export async function getAvailableFreeModels(): Promise<FreeModel[]> {
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
    console.warn('[FreeModelPool] Could not fetch live free models, using fallback:', err);
    return cachedFreeModels ?? FALLBACK_FREE_MODELS;
  }
}

/**
 * Returns a shuffled list of all free model IDs, excluding any models already tried.
 * This ensures every available free model gets a chance if the primary ones are rate-limited.
 */
export async function getDynamicFallbacks(excludeModels: string[]): Promise<string[]> {
  const allModels = await getAvailableFreeModels();
  const excludeSet = new Set(excludeModels);

  const remaining = allModels
    .map((m) => m.id)
    .filter((id) => !excludeSet.has(id));

  // Shuffle so we don't always hammer the same fallback order
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  return remaining;
}

/** Returns the cached models if available (for the /api/models endpoint). */
export function getCachedFreeModels(): FreeModel[] | null {
  return cachedFreeModels;
}

/** Returns the static fallback list. */
export function getStaticFallbackModels(): FreeModel[] {
  return FALLBACK_FREE_MODELS;
}
