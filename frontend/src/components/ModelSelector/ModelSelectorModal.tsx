import { useEffect, useState } from 'react';
import { X, Cpu, RotateCcw, ExternalLink, Edit2, Check } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { useAgentStore } from '../../store/agentStore';

interface Props {
  onClose: () => void;
}

const BUILT_IN_AGENTS = [
  { type: 'manager',    label: 'Manager',    color: '#d8892d', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free', isCustom: false },
  { type: 'researcher', label: 'Researcher', color: '#3B82F6', defaultModel: 'google/gemma-4-31b-it:free', isCustom: false },
  { type: 'coder',      label: 'Coder',      color: '#10B981', defaultModel: 'qwen/qwen3-coder:free', isCustom: false },
  { type: 'tester',     label: 'Tester',     color: '#F59E0B', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free', isCustom: false },
  { type: 'rnd',        label: 'R&D Analyst', color: '#8B5CF6', defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free', isCustom: false },
];

export function ModelSelectorModal({ onClose }: Props) {
  const { freeModels, agentOverrides, isLoading: modelsLoading, fetchModels, setAgentModel, setAgentName, clearAgentOverride } = useModelStore();
  const { agents: customAgents, fetchAgents, isLoading: agentsLoading } = useAgentStore();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    fetchModels();
    fetchAgents();
  }, [fetchModels, fetchAgents]);

  const hasOverrides = Object.keys(agentOverrides).length > 0;
  const isLoading = modelsLoading || agentsLoading;

  const handleStartEdit = (type: string, currentName: string) => {
    setEditingType(type);
    setTempName(currentName);
  };

  const handleSaveName = (type: string) => {
    if (tempName.trim()) {
      setAgentName(type, tempName.trim());
    }
    setEditingType(null);
  };

  const allAgentsFromBackend = customAgents.filter(a => a.is_active).map(a => ({
    type: a.type,
    label: a.name,
    color: a.color || '#6B7280',
    defaultModel: a.model,
    isCustom: !a.is_builtin
  }));

  // Merge built-in fallbacks with backend data, preferring backend data
  const allAgents = BUILT_IN_AGENTS.map(builtIn => {
    const fromBackend = allAgentsFromBackend.find(a => a.type === builtIn.type);
    return fromBackend || builtIn;
  });

  // Add any truly custom agents from backend that aren't in BUILT_IN_AGENTS
  const trulyCustom = allAgentsFromBackend.filter(a => !BUILT_IN_AGENTS.some(b => b.type === a.type));
  allAgents.push(...trulyCustom);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <div
        className="w-[640px] max-h-[85vh] flex flex-col bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border shrink-0 bg-app-surface">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-app-sub" />
            <span className="text-sm font-semibold text-app-text">Agent & Model Configuration</span>
          </div>
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <button
                onClick={() => allAgents.forEach((a) => clearAgentOverride(a.type))}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-app-muted hover:text-app-text hover:bg-app-col transition-colors border border-transparent hover:border-app-border"
                title="Reset all to defaults"
              >
                <RotateCcw size={12} />
                Reset all
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-app-col text-app-muted hover:text-app-text transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="px-5 py-3 bg-app-col/30 border-b border-app-border shrink-0">
          <p className="text-[11px] text-app-muted leading-relaxed">
            Customize agent names and select which free model each agent uses. Overrides are session-specific and apply to the next session you start.
          </p>
        </div>

        {/* Agent rows */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-app-surface z-10 shadow-xs">
              <tr className="border-b border-app-border">
                <th className="px-5 py-2.5 text-[10px] font-bold text-app-muted uppercase tracking-wider w-40">Agent</th>
                <th className="px-5 py-2.5 text-[10px] font-bold text-app-muted uppercase tracking-wider">Model Selection</th>
                <th className="px-5 py-2.5 text-[10px] font-bold text-app-muted uppercase tracking-wider w-24 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40">
              {allAgents.map((agent) => {
                const override = agentOverrides[agent.type];
                const selectedModel = override?.modelId ?? agent.defaultModel;
                const displayName = override?.name ?? agent.label;
                const isOverridden = !!override;

                return (
                  <tr key={agent.type} className="group hover:bg-app-col/20 transition-colors">
                    {/* Agent Name Column */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: agent.color }}
                          />
                          {editingType === agent.type ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                autoFocus
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName(agent.type)}
                                onBlur={() => handleSaveName(agent.type)}
                                className="w-full h-6 px-1.5 rounded text-[12px] bg-app-bg border border-app-sub text-app-text focus:outline-hidden"
                              />
                              <button onClick={() => handleSaveName(agent.type)} className="text-app-sub">
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group/name">
                              <span className="text-[12px] font-medium text-app-text truncate max-w-[120px]">
                                {displayName}
                              </span>
                              <button
                                onClick={() => handleStartEdit(agent.type, displayName)}
                                className="opacity-0 group-hover/name:opacity-100 p-0.5 text-app-muted hover:text-app-text transition-opacity"
                              >
                                <Edit2 size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-app-muted ml-4">
                          {agent.type} {agent.isCustom ? '(Custom)' : '(Built-in)'}
                        </span>
                      </div>
                    </td>

                    {/* Model Select Column */}
                    <td className="px-5 py-4">
                      <div className="relative">
                        {isLoading ? (
                          <div className="h-8 rounded bg-app-col animate-pulse" />
                        ) : (
                          <select
                            value={selectedModel}
                            onChange={(e) => setAgentModel(agent.type, e.target.value)}
                            className="w-full h-8 px-3 pr-8 rounded text-[11px] bg-app-col border border-app-border text-app-text focus:outline-hidden focus:border-app-sub appearance-none cursor-pointer hover:border-app-muted transition-colors"
                          >
                            {freeModels.length === 0 ? (
                              <option value={agent.defaultModel}>{agent.defaultModel}</option>
                            ) : (
                              <>
                                <optgroup label="Recommended">
                                  {freeModels.filter(m => m.id === agent.defaultModel).map(m => (
                                    <option key={m.id} value={m.id}>{m.name || m.id} (Default)</option>
                                  ))}
                                </optgroup>
                                <optgroup label="Available Models">
                                  {freeModels.filter(m => m.id !== agent.defaultModel).map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name || m.id}
                                    </option>
                                  ))}
                                </optgroup>
                              </>
                            )}
                          </select>
                        )}
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-app-muted">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M5 7.5L0.5 3h9L5 7.5z" />
                          </svg>
                        </div>
                      </div>
                    </td>

                    {/* Status Column */}
                    <td className="px-5 py-4 text-right">
                      {isOverridden ? (
                        <button
                          onClick={() => clearAgentOverride(agent.type)}
                          className="px-2 py-1 rounded text-[10px] text-app-sub bg-app-sub/10 hover:bg-app-sub/20 transition-colors flex items-center gap-1 ml-auto"
                          title="Reset to default"
                        >
                          <RotateCcw size={10} />
                          custom
                        </button>
                      ) : (
                        <span className="text-[10px] text-app-muted italic">default</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-app-border flex items-center justify-between shrink-0 bg-app-surface">
          <a
            href="https://openrouter.ai/models?q=:free"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-app-muted hover:text-app-text transition-colors"
          >
            <ExternalLink size={12} />
            Explore all free models
          </a>
          <div className="flex items-center gap-3">
            {isLoading && (
              <span className="text-[10px] text-app-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-app-sub animate-pulse" />
                Updating models…
              </span>
            )}
            {!isLoading && (
              <span className="text-[10px] text-app-muted">
                {freeModels.length} free models available
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-[11px] font-semibold bg-app-text text-app-surface hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
