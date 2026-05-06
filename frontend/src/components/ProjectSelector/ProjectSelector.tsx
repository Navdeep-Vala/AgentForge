import React, { useEffect, useState } from 'react';
import { Folder, Plus, ChevronDown, Check, Settings, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { Project } from '../../types';

export function ProjectSelector() {
  const { projects, currentProject, fetchProjects, setCurrentProject, createProject, deleteProject } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newWorkspacePath, setNewWorkspacePath] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    await createProject(newProjectName, undefined, newWorkspacePath);
    setNewProjectName('');
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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-200 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-all shadow-sm"
      >
        <Folder size={14} className="text-indigo-400" />
        <span className="max-w-[150px] truncate">
          {currentProject ? currentProject.name : 'Select Project'}
        </span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
            <div className="p-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">Projects</span>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-indigo-400 transition-colors"
                title="New Project"
              >
                <Plus size={16} />
              </button>
            </div>

            {showCreate && (
              <form onSubmit={handleCreate} className="p-3 border-b border-gray-800 bg-gray-800/50 space-y-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Project name..."
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Workspace path (optional)..."
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={newWorkspacePath}
                  onChange={(e) => setNewWorkspacePath(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!newProjectName.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold py-1.5 rounded uppercase tracking-wider"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-bold rounded uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="max-h-64 overflow-y-auto py-1">
              <button
                onClick={() => {
                  setCurrentProject(null);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
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
                    onClick={() => {
                      setCurrentProject(p);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                      currentProject?.id === p.id ? 'bg-indigo-900/20 text-indigo-300' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                      <span className="truncate w-48 text-left">{p.name}</span>
                      {p.workspace_path && (
                        <span className="text-[10px] text-gray-500 truncate w-48 text-left">{p.workspace_path}</span>
                      )}
                    </div>
                    {currentProject?.id === p.id && <Check size={14} className="text-indigo-400 flex-shrink-0" />}
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete Project"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {projects.length === 0 && !showCreate && (
                <p className="py-8 text-center text-xs text-gray-600">No projects yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
