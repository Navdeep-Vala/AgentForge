import React, { useEffect, useState } from 'react';
import { Folder, Plus, ChevronDown, Check, Trash2, Pencil } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { ProjectEditModal } from './ProjectEditModal';
import { Project } from '../../types';

export function ProjectSelector() {
  const { projects, currentProject, fetchProjects, setCurrentProject, createProject, deleteProject } =
    useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newWorkspacePath, setNewWorkspacePath] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createProject(newName.trim(), newDescription.trim() || undefined, newRepoUrl.trim() || undefined, newWorkspacePath.trim() || undefined);
    setNewName('');
    setNewDescription('');
    setNewRepoUrl('');
    setNewWorkspacePath('');
    setShowCreate(false);
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
    }
  };

  const handleEdit = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setIsOpen(false);
    setEditingProject(p);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-app-sub bg-app-col border border-app-border hover:border-app-sub transition-all shadow-xs"
        >
          <Folder size={14} className="text-indigo-400" />
          <span className="max-w-[150px] truncate">
            {currentProject ? currentProject.name : 'Select Project'}
          </span>
          <ChevronDown size={14} className={`text-app-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-2 w-72 bg-app-surface border border-app-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-2 border-b border-app-border flex items-center justify-between">
                <span className="text-[10px] font-semibold text-app-muted uppercase tracking-wider px-2">
                  Projects
                </span>
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="p-1 hover:bg-app-col rounded text-app-muted hover:text-indigo-400 transition-colors"
                  title="New Project"
                >
                  <Plus size={16} />
                </button>
              </div>

              {showCreate && (
                <form onSubmit={handleCreate} className="p-3 border-b border-app-border bg-app-col/50 space-y-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Project name *"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <textarea
                    rows={2}
                    placeholder="Context / notes (optional)…"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="GitHub/GitLab URL (optional)…"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    value={newRepoUrl}
                    onChange={(e) => setNewRepoUrl(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Workspace path (optional)…"
                    className="w-full bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text placeholder:text-app-muted focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    value={newWorkspacePath}
                    onChange={(e) => setNewWorkspacePath(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!newName.trim()}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold py-1.5 rounded uppercase tracking-wider"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="px-2 py-1.5 bg-app-col hover:bg-app-border text-app-sub text-[10px] font-bold rounded uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="max-h-64 overflow-y-auto py-1">
                {/* No-project option */}
                <button
                  onClick={() => { setCurrentProject(null); setIsOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-app-sub hover:bg-app-col transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Folder size={14} className="opacity-50" />
                    <span>General (No Project)</span>
                  </div>
                  {!currentProject && <Check size={14} className="text-indigo-400" />}
                </button>

                {projects.map((p) => (
                  <div key={p.id} className="group relative">
                    <button
                      onClick={() => { setCurrentProject(p); setIsOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        currentProject?.id === p.id
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-app-text hover:bg-app-col'
                      }`}
                    >
                      <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                        <span className="truncate w-40 text-left">{p.name}</span>
                        {p.workspace_path && (
                          <span className="text-[10px] text-app-muted truncate w-40 text-left">
                            {p.workspace_path}
                          </span>
                        )}
                        {p.description && !p.workspace_path && (
                          <span className="text-[10px] text-app-muted truncate w-40 text-left">
                            {p.description}
                          </span>
                        )}
                      </div>
                      {currentProject?.id === p.id && (
                        <Check size={14} className="text-indigo-400 shrink-0" />
                      )}
                    </button>
                    {/* Edit button */}
                    <button
                      onClick={(e) => handleEdit(e, p)}
                      className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 text-app-muted hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit Project"
                    >
                      <Pencil size={12} />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-app-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Project"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {projects.length === 0 && !showCreate && (
                  <p className="py-8 text-center text-xs text-app-muted">No projects yet</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {editingProject && (
        <ProjectEditModal project={editingProject} onClose={() => setEditingProject(null)} />
      )}
    </>
  );
}
