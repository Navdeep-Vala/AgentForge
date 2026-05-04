import { Task } from '../../types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  title: string;
  dotColor: string;
  tasks: Task[];
  onViewOutput: (task: Task) => void;
  pulseDot?: boolean;
}

export function KanbanColumn({ title, dotColor, tasks, onViewOutput, pulseDot }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-h-0 bg-app-col rounded-lg border border-app-border">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-app-border flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pulseDot ? 'animate-pulse' : ''}`} />
        <span className="text-[11px] font-semibold text-app-sub tracking-wide">{title}</span>
        <span className="ml-auto text-[10px] font-semibold text-app-muted bg-app-border rounded-full px-1.5 py-0.5 min-w-[18px] text-center tabular-nums">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-[10px] text-app-muted">Empty</p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} onViewOutput={onViewOutput} />
          ))
        )}
      </div>
    </div>
  );
}
