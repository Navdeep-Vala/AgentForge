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
    <section className="min-w-[300px] flex-1 border-r border-[#ede3d6] last:border-r-0">
      <div className="flex items-center gap-3 border-b border-[#ede3d6] px-5 py-4">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-[#5a554e]">{title}</span>
        <span className="ml-auto rounded-[10px] bg-[#f6f1e8] px-3 py-1 text-[13px] text-[#b0a79b]">{tasks.length}</span>
      </div>
      <div className="flex h-[calc(100vh-266px)] flex-col gap-4 overflow-y-auto px-4 py-4">
        {tasks.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#e5dccf] bg-[#fffdf9] px-4 py-8 text-center text-[14px] text-[#b0a79b]">
            No tasks here
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} comments={comments} onOpenTask={onOpenTask} />)
        )}
      </div>
    </section>
  );
}
