import type { Task, TaskComment } from '../../types';
import { formatTimeAgo } from '../MissionControl/dashboardUtils';
import { MentionText } from '../Notifications/MentionText';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  comments: Record<string, TaskComment[]>;
  onOpenTask: (task: Task) => void;
}

export function TaskCard({ task, comments, onOpenTask }: TaskCardProps) {
  const tags = collectTags(task, comments);
  const isApproval = task.status === 'needs_approval';
  const accent = task.status === 'failed' ? '#d26a61' : task.status === 'in_progress' ? '#d8892d' : isApproval ? '#4d7ed6' : '#d3aa68';

  return (
    <button
      onClick={() => onOpenTask(task)}
      className="group w-full rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 text-left shadow-[var(--app-shadow-card)] transition hover:-translate-y-px hover:shadow-[var(--app-shadow-card-md)]"
      style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
    >
      <div className="flex items-start gap-3">
        <span className="pt-0.5 text-[12px] text-[var(--app-accent)]">
          {isApproval ? <AlertCircle size={14} /> : '↑'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--app-text)]">{task.title}</p>
          <div className="mt-2.5 line-clamp-3 text-[13px] leading-6 text-[var(--app-sub)]">
            <MentionText content={task.description} />
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-3 text-[12px] text-[var(--app-muted)]">
            <span className="truncate font-medium text-[var(--app-sub)]">{task.agent_name}</span>
            <span>{formatTimeAgo(task.completed_at ?? task.started_at ?? task.created_at)}</span>
          </div>

          {isApproval && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#4d7ed6]/30 bg-[#4d7ed6]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4d7ed6]">
              <CheckCircle size={11} /> Awaiting Approval
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-[10px] bg-[var(--app-col)] px-2.5 py-1 text-[11px] text-[var(--app-muted)]">
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
