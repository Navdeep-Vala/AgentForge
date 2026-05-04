import React, { useState } from 'react';
import { Play, Square, Loader2, Sparkles } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';

interface GoalBarProps {
  onStart: (goal: string) => void;
  onCancel: () => void;
}

export function GoalBar({ onStart, onCancel }: GoalBarProps) {
  const [goal, setGoal] = useState('');
  const { currentSession, isLoading } = useSessionStore();

  const isRunning = currentSession?.status === 'running' || currentSession?.status === 'pending';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed || isLoading) return;
    onStart(trimmed);
    setGoal('');
  };

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-indigo-400 flex-shrink-0">
          <Sparkles size={14} />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest hidden sm:block">Mission</span>
        </div>

        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe your coding goal… e.g. Add JWT auth to my Express API"
          disabled={isRunning || isLoading}
          className="flex-1 bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
          }}
        />

        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-400 text-xs hover:bg-red-900/40 transition-colors flex-shrink-0"
          >
            <Square size={11} />
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!goal.trim() || isLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex-shrink-0"
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} />}
            {isLoading ? 'Planning…' : 'Run'}
          </button>
        )}
      </form>
    </div>
  );
}
