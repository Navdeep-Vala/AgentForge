import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Bot, Save, AlertCircle, Zap } from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { AgentDefinition, FREE_MODELS } from '../../types';

interface AgentManagerProps {
  onClose: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
];

const PRESET_ICONS = [
  'Bot', 'Search', 'Code2', 'TestTube', 'BarChart2',
  'Shield', 'Zap', 'Database', 'Globe', 'Lock',
  'Cpu', 'Layers', 'Terminal', 'GitBranch', 'Bug',
];

const emptyForm = {
  name: '',
  description: '',
  system_prompt: '',
  model: 'meta-llama/llama-3.3-70b-instruct:free',
  color: '#3B82F6',
  icon: 'Bot',
};

export function AgentManager({ onClose }: AgentManagerProps) {
  const { agents, fetchAgents, addAgent, editAgent, removeAgent } = useAgentStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchAgents(); }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.description.trim() || !form.system_prompt.trim()) {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await editAgent(editingId, form);
      } else {
        await addAgent(form);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (agent: AgentDefinition) => {
    setForm({
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt || '',
      model: agent.model,
      color: agent.color,
      icon: agent.icon,
    });
    setEditingId(agent.id || null);
    setShowForm(true);
  };

  const handleEditBuiltIn = (agent: AgentDefinition) => {
    setForm({
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt || '',
      model: agent.model,
      color: agent.color,
      icon: agent.icon,
    });
    setEditingId(null); // It will be a new custom agent with same type/name
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return;
    await removeAgent(id);
  };

  const builtIn = agents.filter(a => a.is_builtin);
  const custom  = agents.filter(a => !a.is_builtin);

  const inputClass = "bg-app-col border border-app-border rounded px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:outline-hidden focus:border-app-sub transition-colors w-full";

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-app-surface border border-app-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-card-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text">{editingId ? 'Edit Agent' : 'Manage Agents'}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-app-col text-app-muted hover:text-app-text transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-app-col border border-app-border rounded-lg p-4 mb-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-app-muted font-medium uppercase tracking-wider">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Security Auditor"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-app-muted font-medium uppercase tracking-wider">Model</label>
                  <select
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    className={inputClass}
                  >
                    {FREE_MODELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-app-muted font-medium uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Reviews code for security vulnerabilities"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-app-muted font-medium uppercase tracking-wider">System Prompt</label>
                <textarea
                  value={form.system_prompt}
                  onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                  placeholder="You are a senior security engineer..."
                  rows={4}
                  className={`${inputClass} font-mono resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-app-muted font-medium uppercase tracking-wider">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        className="w-6 h-6 rounded border-2 transition-all"
                        style={{ backgroundColor: c, borderColor: form.color === c ? 'white' : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-app-muted font-medium uppercase tracking-wider">Icon</label>
                  <select
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    className={inputClass}
                  >
                    {PRESET_ICONS.map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-[11px]">
                  <AlertCircle size={12} />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); setError(''); }}
                  className="px-4 py-1.5 text-[11px] rounded text-app-sub hover:text-app-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] rounded bg-app-text text-app-surface font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  <Save size={11} />
                  {saving ? 'Saving…' : editingId ? 'Update Agent' : 'Create Agent'}
                </button>
              </div>
            </form>
          )}

          {/* Built-in */}
          <section>
            <p className="text-[10px] font-semibold text-app-muted uppercase tracking-widest mb-3">Built-in Agents</p>
            <div className="flex flex-col gap-2">
              {builtIn.map(agent => (
                <AgentRow
                  key={agent.type}
                  agent={agent}
                  readOnly
                  onEdit={() => handleEditBuiltIn(agent)}
                />
              ))}
            </div>
          </section>

          {/* Custom */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-app-muted uppercase tracking-widest">Custom Agents</p>
              {!showForm && (
                <button
                  onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-app-text text-app-surface text-[11px] font-semibold hover:opacity-80 transition-opacity"
                >
                  <Plus size={12} />
                  Add Agent
                </button>
              )}
            </div>

            {custom.length === 0 && !showForm ? (
              <p className="text-[11px] text-app-muted text-center py-6">No custom agents yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {custom.map(agent => (
                  <AgentRow
                    key={agent.id ?? agent.type}
                    agent={agent}
                    onDelete={() => agent.id && handleDelete(agent.id)}
                    onEdit={() => handleEdit(agent)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  readOnly = false,
  onDelete,
  onEdit,
}: {
  agent: AgentDefinition;
  readOnly?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-app-col border border-app-border rounded-lg px-4 py-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${agent.color}20`, border: `1.5px solid ${agent.color}40` }}
      >
        <Bot size={13} style={{ color: agent.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-semibold text-app-text">{agent.name}</p>
          {readOnly && (
            <span className="text-[9px] text-app-muted bg-app-border px-1.5 py-0.5 rounded font-medium">built-in</span>
          )}
        </div>
        <p className="text-[10px] text-app-muted truncate">{agent.description}</p>
      </div>
      <span className="text-[10px] text-app-muted truncate max-w-24 ml-auto mr-2">{agent.model?.split('/').pop()}</span>
      <div className="flex items-center gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-app-sub/10 text-app-muted hover:text-app-text transition-colors"
            title={readOnly ? "Customize identity" : "Edit agent"}
          >
            {readOnly ? <Plus size={12} /> : <Zap size={12} />}
          </button>
        )}
        {!readOnly && onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-500/10 text-app-muted hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
