import { useState } from 'react';
import { X, RefreshCw, Check, Trash2, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { syncProjectRepo } from '../../api/client';
import { Project } from '../../types';

interface Props {
  project: Project;
  onClose: () => void;
}

export function ProjectEditModal({ project, onClose }: Props) {
  const { updateProject, deleteProject, fetchProjects } = useProjectStore();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [workspacePath, setWorkspacePath] = useState(project.workspace_path ?? '');
  const [repoUrl, setRepoUrl] = useState(project.repo_url ?? '');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(
    project.repo_context ? `${Math.round(project.repo_context.length / 1024)}KB synced` : null
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        workspace_path: workspacePath.trim() || null,
        repo_url: repoUrl.trim() || null,
        updated_at: Date.now(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
    onClose();
  };

  const handleSync = async () => {
    if (!repoUrl.trim()) return;
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      await updateProject(project.id, { repo_url: repoUrl.trim(), updated_at: Date.now() });
      const { size } = await syncProjectRepo(project.id);
      setSyncResult(`Synced · ${Math.round(size / 1024)}KB`);
      await fetchProjects();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text">Edit Project</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-app-col rounded text-app-muted hover:text-app-text transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Description / context notes */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Context / Notes
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this project, tech stack, conventions, or anything agents should know…"
              className="w-full bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Workspace path */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Workspace Path
            </label>
            <input
              type="text"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="/path/to/local/project"
              className="w-full bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Repo URL + sync */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-app-sub uppercase tracking-wider">
              Repo URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setSyncResult(null);
                  setSyncError(null);
                }}
                placeholder="https://github.com/user/repo"
                className="flex-1 bg-app-col border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleSync}
                disabled={!repoUrl.trim() || syncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors shrink-0"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            </div>
            {syncResult && (
              <p className="flex items-center gap-1 text-[11px] text-emerald-500">
                <Check size={11} />
                {syncResult}
              </p>
            )}
            {syncError && (
              <p className="flex items-center gap-1 text-[11px] text-red-400">
                <AlertCircle size={11} />
                {syncError}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-app-border">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-app-sub hover:bg-app-col transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
