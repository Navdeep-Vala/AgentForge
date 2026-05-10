import type { Task, TaskComment } from '../../types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  title: string;
  dotColor: string;
  tasks: Task[];
  comments: Record<string, TaskComment[]>;
  onOpenTask: (task: Task) => void;
}

export function KanbanColumn({ title, dotColor, tasks, comments, onOpenTask }: KanbanColumnProps) {
  return (
    <section className="min-w-[280px] flex-1 border-r border-[var(--app-border)] last:border-r-0">
      <div className="flex items-center gap-2.5 border-b border-[var(--app-border)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--app-sub)]">{title}</span>
        <span className="ml-auto rounded-[10px] bg-[var(--app-col)] px-2.5 py-1 text-[11px] text-[var(--app-muted)]">{tasks.length}</span>
      </div>
      <div className="flex h-[calc(100vh-208px)] flex-col gap-3 overflow-y-auto px-3 py-3">
        {tasks.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-6 text-center text-[12px] text-[var(--app-muted)]">
            No tasks here
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} comments={comments} onOpenTask={onOpenTask} />)
        )}
      </div>
    </section>
  );
}
