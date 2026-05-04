import { useEffect } from 'react';
import { X, Cpu, RotateCcw, ExternalLink } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';

interface Props {
  onClose: () => void;
}

const BUILT_IN_AGENTS = [
  { type: 'researcher', label: 'Researcher', color: '#3B82F6', defaultModel: 'google/gemma-4-31b-it:free' },
  { type: 'coder',      label: 'Coder',      color: '#10B981', defaultModel: 'qwen/qwen3-coder:free' },
  { type: 'tester',     label: 'Tester',     color: '#F59E0B', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free' },
  { type: 'rnd',        label: 'R&D Analyst', color: '#8B5CF6', defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free' },
];

export function ModelSelectorModal({ onClose }: Props) {
  const { freeModels, agentOverrides, isLoading, fetchModels, setAgentModel, clearAgentOverride } = useModelStore();

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const hasOverrides = Object.keys(agentOverrides).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[560px] max-h-[80vh] flex flex-col bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-app-sub" />
            <span className="text-[13px] font-semibold text-app-text">Model Configuration</span>
          </div>
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <button
                onClick={() => BUILT_IN_AGENTS.forEach((a) => clearAgentOverride(a.type))}
                className="flex items-center gap-1 px-2 h-6 rounded text-[10px] text-app-muted hover:text-app-text hover:bg-app-col transition-colors"
                title="Reset all to defaults"
              >
                <RotateCcw size={10} />
                Reset all
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-app-col text-app-muted hover:text-app-text transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="px-5 py-2.5 text-[11px] text-app-muted border-b border-app-border flex-shrink-0">
          Choose which free model each agent uses. Overrides apply to the next session you start.
        </p>

        {/* Agent rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-app-border/60">
          {BUILT_IN_AGENTS.map((agent) => {
            const selected = agentOverrides[agent.type] ?? agent.defaultModel;
            const isOverridden = !!agentOverrides[agent.type];

            return (
              <div key={agent.type} className="px-5 py-3 flex items-center gap-4">
                {/* Agent badge */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="text-[12px] font-medium text-app-text w-24 flex-shrink-0">{agent.label}</span>

                {/* Model select */}
                <div className="flex-1 relative">
                  {isLoading ? (
                    <div className="h-7 rounded bg-app-col animate-pulse" />
                  ) : (
                    <select
                      value={selected}
                      onChange={(e) => setAgentModel(agent.type, e.target.value)}
                      className="w-full h-7 px-2 pr-6 rounded text-[11px] bg-app-col border border-app-border text-app-text focus:outline-none focus:border-app-sub appearance-none cursor-pointer"
                    >
                      {freeModels.length === 0 ? (
                        <option value={agent.defaultModel}>{agent.defaultModel}</option>
                      ) : (
                        freeModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.id}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-app-muted">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                      <path d="M4 5.5L0.5 2h7L4 5.5z" />
                    </svg>
                  </div>
                </div>

                {/* Override indicator / reset */}
                {isOverridden ? (
                  <button
                    onClick={() => clearAgentOverride(agent.type)}
                    className="text-[9px] text-app-muted hover:text-app-text flex-shrink-0 flex items-center gap-0.5 transition-colors"
                    title="Reset to default"
                  >
                    <RotateCcw size={9} />
                    reset
                  </button>
                ) : (
                  <span className="text-[9px] text-app-muted flex-shrink-0 w-10 text-right">default</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-app-border flex items-center justify-between flex-shrink-0">
          <a
            href="https://openrouter.ai/models?q=:free"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-text transition-colors"
          >
            <ExternalLink size={9} />
            Browse all free models on OpenRouter
          </a>
          <div className="flex items-center gap-1.5">
            {isLoading && (
              <span className="text-[10px] text-app-muted">Fetching live models…</span>
            )}
            <span className="text-[10px] text-app-muted">
              {freeModels.length > 0 && !isLoading ? `${freeModels.length} models available` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
