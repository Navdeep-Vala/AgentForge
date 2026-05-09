import { useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Send, X } from 'lucide-react';
import { addTaskComment } from '../../api/client';
import type { Task, TaskComment } from '../../types';
import { formatDateTime, formatTimeAgo, taskComments } from '../MissionControl/dashboardUtils';

interface TaskDetailModalProps {
  task: Task;
  comments: Record<string, TaskComment[]>;
  onClose: () => void;
}

export function TaskDetailModal({ task, comments, onClose }: TaskDetailModalProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const conversation = useMemo(() => taskComments(task.id, comments), [task.id, comments]);

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      await addTaskComment(task.id, {
        agent_type: 'navdeep',
        agent_name: 'Navdeep',
        content,
        comment_type: 'review',
      });
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]">
      <div className="h-full w-full max-w-[640px] overflow-hidden border-l border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#4d7ed6]" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]">Task Detail</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--app-muted)] transition hover:bg-[var(--app-col)] hover:text-[var(--app-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="h-[calc(100%-69px)] overflow-y-auto px-6 py-6">
          <h2 className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--app-text)]">
            {task.title}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={task.status === 'done' ? 'green' : task.status === 'in_progress' ? 'amber' : 'neutral'}>
              {task.status === 'in_progress' ? 'Active' : task.status}
            </Badge>
            <Badge tone="amber">{taskNeedsHighAttention(task, conversation) ? 'High' : 'Normal'}</Badge>
            <GhostTag>{task.agent_name}</GhostTag>
            {task.spawned_by_agent && <GhostTag>from @{task.spawned_by_agent}</GhostTag>}
          </div>

          <Section title="Description">
            <p className="text-[15px] leading-7 text-[var(--app-sub)]">{task.description}</p>
          </Section>

          <Section title="Context">
            <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-col)] p-4 text-[14px] leading-6 text-[var(--app-sub)]">
              {task.output ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.output}</ReactMarkdown>
              ) : (
                <p>No deliverable has been attached yet.</p>
              )}
            </div>
          </Section>

          <Section title="Assignee">
            <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <p className="text-[16px] font-semibold text-[var(--app-text)]">{task.agent_name}</p>
              <p className="mt-1 text-[13px] text-[var(--app-muted)]">{task.agent_type}</p>
            </div>
          </Section>

          <Section title="Timeline">
            <TimelineRow label="Created" value={formatDateTime(task.created_at)} />
            <TimelineRow label="Started" value={formatDateTime(task.started_at)} />
            <TimelineRow label="Updated" value={formatTimeAgo(task.completed_at ?? task.started_at ?? task.created_at)} />
          </Section>

          <Section title={`Comments (${conversation.length})`}>
            <div className="space-y-4">
              {conversation.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-6 text-center text-[13px] text-[var(--app-muted)]">
                  No comments yet. Add your review or mention a teammate with `@name`.
                </div>
              ) : (
                conversation.map((comment) => (
                  <article key={comment.id} className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 shadow-[var(--app-shadow-card)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[15px] font-semibold text-[var(--app-text)]">{comment.agent_name}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{comment.comment_type}</p>
                      </div>
                      <span className="text-[12px] text-[var(--app-muted)]">{formatTimeAgo(comment.created_at)}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-[var(--app-sub)]">{comment.content}</p>
                  </article>
                ))
              )}
            </div>

            <div className="mt-4 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Add Comment</p>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Share a review note, decision, or mention a teammate with @name..."
                className="mt-3 min-h-[96px] w-full resize-none rounded-[16px] border border-[var(--app-border)] bg-[var(--app-col)] px-4 py-3 text-[14px] leading-6 text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-[var(--app-muted)]">All finished tasks can be reviewed here.</p>
                <button
                  onClick={handleSubmit}
                  disabled={!draft.trim() || submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Post Comment
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--app-border)] py-3 text-[13px] last:border-b-0">
      <span className="text-[var(--app-muted)]">{label}</span>
      <span className="text-right text-[var(--app-text)]">{value}</span>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'amber' | 'neutral' }) {
  const className =
    tone === 'green'
      ? 'border-[#2fba82] bg-[#2fba82] text-white'
      : tone === 'amber'
        ? 'border-[#d3aa68] bg-white text-[#b6873b]'
        : 'border-[#e8e0d4] bg-[#fbf7f1] text-[#7a7267]';

  return <span className={`rounded-[12px] border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`}>{children}</span>;
}

function GhostTag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-[var(--app-col)] px-3 py-1.5 text-[11px] text-[var(--app-muted)]">{children}</span>;
}

function taskNeedsHighAttention(task: Task, comments: TaskComment[]) {
  return comments.some((comment) => /@navdeep/i.test(comment.content)) || task.status === 'failed';
}
