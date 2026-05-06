export interface AgentOverride {
  modelId?: string;
  name?: string;
}

const THEME_KEY = 'agentforge-theme';
const MODEL_OVERRIDES_KEY = 'agentforge-model-overrides-v2';

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and continue with in-memory state.
  }
}

export function loadPersistedTheme(): 'dark' | 'light' {
  const persisted = readJson<{ state?: { theme?: 'dark' | 'light' }; theme?: 'dark' | 'light' }>(
    THEME_KEY
  );

  if (persisted?.state?.theme === 'dark' || persisted?.state?.theme === 'light') {
    return persisted.state.theme;
  }

  if (persisted?.theme === 'dark' || persisted?.theme === 'light') {
    return persisted.theme;
  }

  return 'dark';
}

export function persistTheme(theme: 'dark' | 'light'): void {
  writeJson(THEME_KEY, { state: { theme }, version: 0 });
}

export function loadPersistedAgentOverrides(): Record<string, AgentOverride> {
  const persisted = readJson<{
    state?: { agentOverrides?: Record<string, AgentOverride> };
    agentOverrides?: Record<string, AgentOverride>;
  }>(MODEL_OVERRIDES_KEY);

  return persisted?.state?.agentOverrides ?? persisted?.agentOverrides ?? {};
}

export function persistAgentOverrides(agentOverrides: Record<string, AgentOverride>): void {
  writeJson(MODEL_OVERRIDES_KEY, { state: { agentOverrides }, version: 0 });
}
