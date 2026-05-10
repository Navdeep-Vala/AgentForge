import { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Loader2, FileText, Bot, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProjectStore } from '../../store/projectStore';
import { api } from '../../api/client';

interface ProjectContextModalProps {
  onClose: () => void;
}

export function ProjectContextModal({ onClose }: ProjectContextModalProps) {
  const { currentProject, fetchProjects } = useProjectStore();
  const [content, setContent] = useState(currentProject?.repo_context || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentProject?.repo_context) {
      setContent(currentProject.repo_context);
    }
  }, [currentProject]);

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/projects/${currentProject.id}`, { repo_context: content });
      await fetchProjects();
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save context');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!currentProject) return;
    setSyncing(true);
    setError('');
    try {
      // Trigger raw sync first
      await api.post(`/projects/${currentProject.id}/sync`, {});
      await fetchProjects();
      
      // Optionally, we could trigger an agent task here to "Analyze"
      // For now, raw sync is a good first step.
    } catch (err: any) {
      setError(err.message || 'Failed to sync repository');
    } finally {
      setSyncing(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div 
      className="fixed inset-0 z-50 grid place-items-center bg-black/20 backdrop-blur-[2px] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl h-[85vh] rounded-[32px] border border-app-border bg-app-surface p-2 shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-app-col rounded-[28px] p-6 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Bot size={20} className="text-app-accent" />
                <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-app-text">Project Context</h2>
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-app-muted mt-1">
                {currentProject.name} — Knowledge Base & Codebase Analysis
              </p>
            </div>
            <div className="flex items-center gap-2">
              {currentProject.repo_url && (
                <button 
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-app-surface border border-app-border text-[12px] font-medium text-app-sub hover:bg-app-col transition-colors disabled:opacity-50"
                  title="Re-fetch raw repository data"
                >
                  {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Sync Repo
                </button>
              )}
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-app-surface border border-app-border text-[12px] font-medium text-app-sub hover:bg-app-col transition-colors"
              >
                <FileText size={14} />
                {isEditing ? 'View Mode' : 'Edit Mode'}
              </button>
              <button onClick={onClose} className="rounded-full bg-app-surface p-2 text-app-muted shadow-sm transition hover:text-app-text">
                <X size={18} />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs shrink-0">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative bg-app-surface rounded-2xl border border-app-border">
            {isEditing ? (
              <div className="h-full flex flex-col">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 w-full p-6 text-[14px] leading-relaxed text-app-text bg-transparent outline-none resize-none font-mono"
                  placeholder="Paste codebase summaries, architecture notes, or file analysis here..."
                />
                <div className="p-4 border-t border-app-border flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-app-accent text-white text-[13px] font-semibold transition hover:brightness-95 disabled:opacity-50 shadow-lg shadow-app-accent/20"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Context
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-8 custom-scrollbar">
                {content ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12">
                    <div className="w-16 h-16 rounded-full bg-app-col flex items-center justify-center mb-4">
                      <Bot size={32} className="text-app-muted" />
                    </div>
                    <h3 className="text-lg font-semibold text-app-text mb-2">No Context Gathered Yet</h3>
                    <p className="text-sm text-app-muted max-w-sm">
                      Agents use this context to understand the project structure and rules. 
                      Click 'Sync Repo' to fetch raw data or 'Edit Mode' to add your own documentation.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between shrink-0">
            <p className="text-[10px] text-app-muted italic">
              * This context is automatically injected into all agent prompts when working on this project.
            </p>
            {currentProject.repo_url && (
              <p className="text-[10px] text-app-muted">
                Repo: <span className="font-mono">{currentProject.repo_url}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
