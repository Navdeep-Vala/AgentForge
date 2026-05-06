import { useState } from 'react';
import { LayoutGrid, AlertTriangle, Loader2 } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { KanbanColumn } from './KanbanColumn';
import { FinalReport } from '../FinalReport/FinalReport';
import { OutputModal } from '../OutputModal/OutputModal';
import { Task } from '../../types';

export function MissionQueue() {
  const { currentSession, error } = useSessionStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const tasks = currentSession?.tasks ?? [];

  const queue      = tasks.filter(t => t.status === 'todo');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const done       = tasks.filter(t => t.status === 'done');
  const failed     = tasks.filter(t => t.status === 'failed' || t.status === 'cancelled');

  // No session at all — show welcome state
  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-6">
        <div className="w-14 h-14 rounded-xl bg-app-col border border-app-border flex items-center justify-center">
          <LayoutGrid size={24} className="text-app-muted" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">Your AI team is standing by</p>
          <p className="text-xs text-app-muted mt-1">Enter a goal above to deploy your agent team</p>
        </div>
        <div className="flex items-center gap-5 mt-1">
          {[
            { label: 'Researcher', color: '#3B82F6' },
            { label: 'Coder',      color: '#10B981' },
            { label: 'Tester',     color: '#F59E0B' },
            { label: 'R&D',        color: '#8B5CF6' },
          ].map(a => (
            <div key={a.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="text-[10px] text-app-muted">{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Session exists but failed before creating any tasks
  if (currentSession.status === 'cancelled' && tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-6">
        <div className="w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">Session Failed</p>
          <p className="text-xs text-app-muted mt-1 max-w-md">
            {error || 'The session was cancelled before tasks could be created.'}
          </p>
          <p className="text-xs text-app-muted mt-2">
            Goal: <span className="text-app-text italic">"{currentSession.goal}"</span>
          </p>
        </div>
        <p className="text-[10px] text-app-muted">Use the <span className="font-semibold text-amber-500">Retry</span> button above to try again</p>
      </div>
    );
  }

  // Session pending — manager is planning
  if (currentSession.status === 'pending' || (currentSession.status === 'running' && tasks.length === 0)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-6">
        <div className="relative w-14 h-14 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <Loader2 size={24} className="text-pink-500 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">Manager is analyzing your goal</p>
          <p className="text-xs text-app-muted mt-1 max-w-md">
            Breaking down <span className="text-app-text italic">"{currentSession.goal}"</span> into actionable tasks…
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-pink-500"
                style={{
                  animation: 'pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>
          <span className="text-[10px] text-pink-500 font-medium">This usually takes 10–30 seconds</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Queue header */}
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 border-b border-app-border">
        <LayoutGrid size={12} className="text-app-muted" />
        <span className="text-[10px] font-semibold text-app-muted uppercase tracking-widest">Mission Queue</span>
        <span className="text-[10px] text-app-muted ml-1">· {tasks.length} tasks</span>
        {currentSession.status === 'running' && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Running
          </span>
        )}
        {currentSession.status === 'completed' && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        )}
        {currentSession.status === 'cancelled' && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Cancelled
          </span>
        )}
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-hidden px-4 pt-4 pb-2">
        <div className="h-full grid grid-cols-4 gap-3">
          <KanbanColumn
            title="Queue"
            dotColor="bg-app-muted"
            tasks={queue}
            onViewOutput={setSelectedTask}
          />
          <KanbanColumn
            title="In Progress"
            dotColor="bg-amber-400"
            tasks={inProgress}
            onViewOutput={setSelectedTask}
            pulseDot
          />
          <KanbanColumn
            title="Done"
            dotColor="bg-emerald-500"
            tasks={done}
            onViewOutput={setSelectedTask}
          />
          <KanbanColumn
            title="Failed"
            dotColor="bg-red-500"
            tasks={failed}
            onViewOutput={setSelectedTask}
          />
        </div>
      </div>

      <FinalReport />

      {selectedTask && <OutputModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}
