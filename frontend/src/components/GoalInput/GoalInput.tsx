import React, { useState } from 'react';
import { Play, Square, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useSessionStore } from '../../store/sessionStore';

interface GoalInputProps {
  onStart: (goal: string, projectId?: string, workspaceDir?: string) => void;
  onCancel: () => void;
}

export function GoalInput({ onStart, onCancel }: GoalInputProps) {
  const [goal, setGoal] = useState('');
  const { currentSession, isLoading } = useSessionStore();
  const { currentProject } = useProjectStore();

  const isRunning = currentSession?.status === 'running' || currentSession?.status === 'pending';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed || isLoading) return;
    onStart(trimmed, currentProject?.id, currentProject?.workspace_path || undefined);
    setGoal('');
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xs">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-400">
            What do you want to build or improve today?
          </label>
          {currentProject && (
            <div className="flex items-center gap-1.5 text-[10px] bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded border border-indigo-800/50">
              <span className="font-bold uppercase opacity-70">Active Project:</span>
              <span>{currentProject.name}</span>
            </div>
          )}
        </div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={currentProject?.workspace_path 
            ? `Ask something about ${currentProject.name} at ${currentProject.workspace_path}...` 
            : "e.g. Add JWT authentication to my Express API..."}
          disabled={isRunning || isLoading}
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-600 text-sm resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">Press ⌘+Enter to submit</p>
          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-900/40 border border-red-800 text-red-400 text-sm hover:bg-red-900/60 transition-colors"
              >
                <Square size={13} />
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!goal.trim() || isRunning || isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              Run Agent Team
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
