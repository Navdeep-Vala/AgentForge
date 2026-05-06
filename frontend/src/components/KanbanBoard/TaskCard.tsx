import { useState, useEffect } from 'react';
import { ExternalLink, Clock } from 'lucide-react';
import { Task } from '../../types';

const AGENT_META: Record<string, { color: string; tag: string; initials: string }> = {
  researcher: { color: '#3B82F6', tag: 'RES', initials: 'RS' },
  coder:      { color: '#10B981', tag: 'COD', initials: 'CD' },
  tester:     { color: '#F59E0B', tag: 'QA',  initials: 'QA' },
  rnd:        { color: '#8B5CF6', tag: 'RND', initials: 'RD' },
};

function useElapsed(startedAt: number | null, status: string): string {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (status !== 'in_progress' || !startedAt) { setElapsed(''); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt, status]);
  return elapsed;
}

interface TaskCardProps {
  task: Task;
  onViewOutput: (task: Task) => void;
}

export function TaskCard({ task, onViewOutput }: TaskCardProps) {
  const meta = AGENT_META[task.agent_type] ?? { color: '#6B7280', tag: 'AGT', initials: task.agent_name.slice(0, 2).toUpperCase() };
  const elapsed = useElapsed(task.started_at, task.status);

  const accentColor =
    task.status === 'in_progress' ? '#F59E0B' :
    task.status === 'done'        ? '#10B981' :
    task.status === 'failed'      ? '#EF4444' :
    '#9CA3AF';

  return (
    <div
      className="bg-white rounded-md shadow-card border border-gray-200 border-l-[3px] p-3 flex flex-col gap-2 hover:shadow-card-md transition-shadow cursor-default"
      style={{ borderLeftColor: accentColor }}
    >
      {/* Title */}
      <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 mt-auto">
        {/* Agent badge */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold shrink-0"
            style={{ backgroundColor: meta.color }}
          >
            {meta.initials}
          </div>
          <span
            className="text-[8px] font-bold px-1 py-0.5 rounded"
            style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
          >
            {meta.tag}
          </span>
        </div>

        {/* Right: timer / token count / actions */}
        <div className="flex items-center gap-1.5">
          {task.status === 'in_progress' && elapsed && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-600 font-medium">
              <Clock size={8} />
              {elapsed}
            </span>
          )}
          {task.status === 'done' && task.tokens_used > 0 && (
            <span className="text-[9px] text-gray-400 tabular-nums">{task.tokens_used.toLocaleString()} tk</span>
          )}
          {task.status === 'failed' && (
            <span className="text-[9px] text-red-500 font-semibold">Failed</span>
          )}
          {(task.status === 'done' || task.status === 'failed') && task.output && (
            <button
              onClick={() => onViewOutput(task)}
              className="flex items-center gap-0.5 text-[9px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
            >
              <ExternalLink size={8} />
              View
            </button>
          )}
        </div>
      </div>

      {/* Progress bar for in-progress tasks */}
      {task.status === 'in_progress' && (
        <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden -mx-3 -mb-3 mt-1">
          <div className="h-full bg-amber-400 rounded-full animate-pulse w-2/3" />
        </div>
      )}
    </div>
  );
}
