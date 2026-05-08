import type { Task, TaskComment } from '../../types';
import { formatTimeAgo } from '../MissionControl/dashboardUtils';

interface TaskCardProps {
  task: Task;
  comments: Record<string, TaskComment[]>;
  onOpenTask: (task: Task) => void;
}

export function TaskCard({ task, comments, onOpenTask }: TaskCardProps) {
  const tags = collectTags(task, comments);
  const accent = task.status === 'failed' ? '#d26a61' : task.status === 'in_progress' ? '#d8892d' : '#d3aa68';

  return (
    <button
      onClick={() => onOpenTask(task)}
      className="group w-full rounded-[28px] border border-[#e8e0d4] bg-white px-5 py-5 text-left shadow-[0_12px_30px_rgba(186,160,119,0.08)] transition hover:-translate-y-px hover:shadow-[0_18px_38px_rgba(186,160,119,0.14)]"
      style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
    >
      <div className="flex items-start gap-4">
        <span className="pt-1 text-[15px] text-[#c48a29]">↑</span>
        <div className="min-w-0 flex-1">
          <p className="text-[24px] font-semibold leading-[1.25] tracking-[-0.03em] text-[#1f1d1a]">{task.title}</p>
          <p className="mt-4 line-clamp-3 text-[17px] leading-7 text-[#7b7469]">{task.description}</p>

          <div className="mt-5 flex items-center justify-between gap-3 text-[14px] text-[#968d82]">
            <span className="truncate font-medium text-[#554f47]">{task.agent_name}</span>
            <span>{formatTimeAgo(task.completed_at ?? task.started_at ?? task.created_at)}</span>
          </div>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-[12px] bg-[#f5f0e7] px-3 py-1.5 text-[13px] text-[#a2988c]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function collectTags(task: Task, comments: Record<string, TaskComment[]>) {
  const words = new Set<string>();
  for (const word of task.title.split(/\s+/)) {
    const cleaned = word.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (cleaned.length > 4 && words.size < 3) words.add(cleaned);
  }

  for (const comment of comments[task.id] ?? []) {
    const mentionMatch = comment.content.match(/@([a-z0-9_-]+)/i);
    if (mentionMatch && words.size < 5) words.add(`@${mentionMatch[1]}`);
  }

  if (task.spawned_by_agent && words.size < 5) words.add(`from-${task.spawned_by_agent}`);
  return Array.from(words);
}
