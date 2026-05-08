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
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(244,238,229,0.44)] backdrop-blur-[2px]">
      <div className="h-full w-full max-w-[780px] overflow-hidden border-l border-[#e6ddcf] bg-[#fffdfa] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ece3d6] px-8 py-6">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#4d7ed6]" />
            <span className="text-[15px] font-semibold uppercase tracking-[0.28em] text-[#21201e]">Task Detail</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[#9d9589] transition hover:bg-[#f7f1e8] hover:text-[#21201e]">
            <X size={18} />
          </button>
        </div>

        <div className="h-[calc(100%-88px)] overflow-y-auto px-8 py-8">
          <h2 className="max-w-2xl text-[40px] font-semibold leading-tight tracking-[-0.03em] text-[#191816]">
            {task.title}
          </h2>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge tone={task.status === 'done' ? 'green' : task.status === 'in_progress' ? 'amber' : 'neutral'}>
              {task.status === 'in_progress' ? 'Active' : task.status}
            </Badge>
            <Badge tone="amber">{taskNeedsHighAttention(task, conversation) ? 'High' : 'Normal'}</Badge>
            <GhostTag>{task.agent_name}</GhostTag>
            {task.spawned_by_agent && <GhostTag>from @{task.spawned_by_agent}</GhostTag>}
          </div>

          <Section title="Description">
            <p className="text-[18px] leading-8 text-[#3e3a34]">{task.description}</p>
          </Section>

          <Section title="Context">
            <div className="rounded-[24px] border border-[#ece4d8] bg-[#fbf8f2] p-5 text-[16px] leading-7 text-[#403a33]">
              {task.output ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.output}</ReactMarkdown>
              ) : (
                <p>No deliverable has been attached yet.</p>
              )}
            </div>
          </Section>

          <Section title="Assignee">
            <div className="rounded-[24px] border border-[#ece4d8] bg-[#fffdf9] p-5">
              <p className="text-[20px] font-semibold text-[#191816]">{task.agent_name}</p>
              <p className="mt-1 text-[15px] text-[#8b8478]">{task.agent_type}</p>
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
                <div className="rounded-[22px] border border-dashed border-[#e4dccf] bg-[#fffdf9] px-5 py-8 text-center text-[15px] text-[#a49b90]">
                  No comments yet. Add your review or mention a teammate with `@name`.
                </div>
              ) : (
                conversation.map((comment) => (
                  <article key={comment.id} className="rounded-[26px] border border-[#ebe2d6] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(196,171,132,0.08)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[18px] font-semibold text-[#23211d]">{comment.agent_name}</p>
                        <p className="mt-1 text-[13px] uppercase tracking-[0.18em] text-[#a0978b]">{comment.comment_type}</p>
                      </div>
                      <span className="text-[14px] text-[#a1988d]">{formatTimeAgo(comment.created_at)}</span>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-[17px] leading-8 text-[#403a33]">{comment.content}</p>
                  </article>
                ))
              )}
            </div>

            <div className="mt-5 rounded-[28px] border border-[#e8e0d4] bg-[#fffdfa] p-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9f968a]">Add Comment</p>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Share a review note, decision, or mention a teammate with @name..."
                className="mt-3 min-h-[120px] w-full resize-none rounded-[20px] border border-[#ece3d6] bg-[#fbf8f2] px-4 py-3 text-[16px] leading-7 text-[#23211d] outline-none transition focus:border-[#d7b176]"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[13px] text-[#9e9588]">All finished tasks can be reviewed here.</p>
                <button
                  onClick={handleSubmit}
                  disabled={!draft.trim() || submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[#efc28e] px-5 py-3 text-[14px] font-semibold text-[#fffdfa] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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
    <section className="mt-12">
      <p className="text-[14px] font-semibold uppercase tracking-[0.24em] text-[#aba295]">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f0e7db] py-4 text-[16px] last:border-b-0">
      <span className="text-[#a1988c]">{label}</span>
      <span className="text-right text-[#2b2823]">{value}</span>
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

  return <span className={`rounded-[14px] border px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.14em] ${className}`}>{children}</span>;
}

function GhostTag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-[#f5f0e7] px-3 py-1.5 text-[13px] text-[#9b9286]">{children}</span>;
}

function taskNeedsHighAttention(task: Task, comments: TaskComment[]) {
  return comments.some((comment) => /@navdeep/i.test(comment.content)) || task.status === 'failed';
}
