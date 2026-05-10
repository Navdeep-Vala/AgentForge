import { useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Send, X, CheckCircle, AlertCircle, Bot } from 'lucide-react';
import { addTaskComment, approveTask } from '../../api/client';
import type { Task, TaskComment, SubAgent, ClarificationRequest } from '../../types';
import { formatDateTime, formatTimeAgo, taskComments } from '../MissionControl/dashboardUtils';
import { MentionAutocomplete } from '../Notifications/MentionAutocomplete';
import { MentionText } from '../Notifications/MentionText';

interface TaskDetailModalProps {
  task: Task;
  comments: Record<string, TaskComment[]>;
  subAgents: SubAgent[];
  clarificationRequests: ClarificationRequest[];
  childTasks: Task[];
  onClose: () => void;
}

export function TaskDetailModal({ task, comments, subAgents, clarificationRequests, childTasks, onClose }: TaskDetailModalProps) {
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

  const handleApprove = async (approved: boolean, feedback?: string) => {
    if (!task.id) return;
    await approveTask(task.id, approved, feedback);
  };

  const taskSubAgents = subAgents.filter((sa) => sa.task_id === task.id);
  const taskClarifications = clarificationRequests.filter((c) => c.task_id === task.id);

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="h-full w-full max-w-[680px] overflow-hidden border-l border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#4d7ed6]" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]">Task Detail</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--app-muted)] transition hover:bg-[var(--app-col)] hover:text-[var(--app-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="h-[calc(100vh-69px)] overflow-y-auto px-6 py-6">
          <h2 className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--app-text)]">
            {task.title}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={task.status === 'done' ? 'green' : task.status === 'in_progress' ? 'amber' : task.status === 'needs_approval' ? 'blue' : task.status === 'waiting_for_predecessor' ? 'purple' : 'neutral'}>
              {task.status === 'in_progress' ? 'Active' : task.status === 'needs_approval' ? 'Awaiting Approval' : task.status === 'waiting_for_predecessor' ? 'Waiting for Predecessor' : task.status}
            </Badge>
            <Badge tone="amber">{taskNeedsHighAttention(task, conversation) ? 'High' : 'Normal'}</Badge>
            <GhostTag>{task.agent_name}</GhostTag>
            {task.spawned_by_agent && <GhostTag>from @{task.spawned_by_agent}</GhostTag>}
            
            {task.model_used && (
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--app-border)] px-3 py-1 bg-[var(--app-col)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">Model:</span>
                <span className="text-[11px] font-mono text-[var(--app-text)]">{task.model_used.split('/').pop()}</span>
              </div>
            )}
            {task.tokens_used > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--app-border)] px-3 py-1 bg-[var(--app-col)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">Tokens:</span>
                <span className="text-[11px] font-mono text-[var(--app-success)]">{task.tokens_used.toLocaleString()}</span>
              </div>
            )}
          </div>

          <Section title="Description">
            <p className="text-[15px] leading-7 text-[var(--app-sub)]">{task.description}</p>
          </Section>

          {task.thought && (
            <Section title="Internal Monologue & Reasoning">
              <div className="rounded-[18px] border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)]/20 p-5 text-[14px] leading-relaxed text-[var(--app-sub)] italic">
                <MentionText content={task.thought} />
              </div>
            </Section>
          )}

          <Section title="Context">
            <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-col)] p-4 text-[14px] leading-6 text-[var(--app-sub)]">
              {task.output ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.output}</ReactMarkdown>
              ) : (
                <p>No deliverable has been attached yet.</p>
              )}
            </div>
          </Section>

          {/* Sub-Agents Section */}
          {taskSubAgents.length > 0 && (
            <Section title={`Sub-Agents (${taskSubAgents.length})`}>
              <div className="space-y-3">
                {taskSubAgents.map((sa) => (
                  <div key={sa.id} className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Bot size={14} className="text-[var(--app-sub)]" />
                        <p className="text-[15px] font-semibold text-[var(--app-text)]">{sa.title}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        sa.status === 'completed'
                          ? 'border-[#2fba82] bg-[#2fba82]/10 text-[#2fba82]'
                          : sa.status === 'failed'
                          ? 'border-[#d26a61] bg-[#d26a61]/10 text-[#d26a61]'
                          : 'border-[var(--app-border)] bg-[var(--app-col)] text-[var(--app-sub)]'
                      }`}>
                        {sa.status}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] text-[var(--app-sub)]">Type: {sa.sub_agent_type} • {formatTimeAgo(sa.created_at)}</p>
                    {sa.output && (
                      <div className="mt-3 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-col)] p-3 text-[13px] leading-6 text-[var(--app-sub)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{sa.output}</ReactMarkdown>
                      </div>
                    )}
                    {sa.thought && (
                      <div className="mt-2 rounded-[12px] border border-[var(--app-accent)]/10 bg-[var(--app-accent-soft)]/10 p-3 text-[12px] leading-relaxed text-[var(--app-sub)] italic">
                        <MentionText content={sa.thought} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Child Tasks */}
          {childTasks.length > 0 && (
            <Section title={`Sub-Tasks (${childTasks.length})`}>
              <div className="space-y-2">
                {childTasks.map((ct) => (
                  <button
                    key={ct.id}
                    onClick={() => {}}
                    className="flex w-full items-center justify-between rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left hover:bg-[var(--app-col)] transition"
                  >
                    <p className="text-[14px] font-medium text-[var(--app-text)]">{ct.title}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      ct.status === 'done' ? 'border-[#2fba82] bg-[#2fba82]/10 text-[#2fba82]' : 'border-[var(--app-border)] bg-[var(--app-col)] text-[var(--app-sub)]'
                    }`}>
                      {ct.status}
                    </span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Clarification Requests */}
          {taskClarifications.length > 0 && (
            <Section title={`Clarification Requests (${taskClarifications.length})`}>
              <div className="space-y-3">
                {taskClarifications.map((cl) => (
                  <div key={cl.id} className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold text-[var(--app-text)]">{cl.agent_name || 'Agent'} asked:</p>
                        <p className="mt-1 text-[13px] text-[var(--app-sub)]">{cl.question}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        cl.status === 'answered'
                          ? 'border-[#2fba82] bg-[#2fba82]/10 text-[#2fba82]'
                          : 'border-[#d8a14a] bg-[#d8a14a]/10 text-[#d8a14a]'
                      }`}>
                        {cl.status}
                      </span>
                    </div>
                    {cl.response && (
                      <div className="mt-3 rounded-[12px] border border-[#2fba82]/30 bg-[#2fba82]/5 p-3 text-[13px] leading-6 text-[#2fba82]">
                        <strong>Response:</strong> {cl.response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {task.status === 'needs_approval' && (
            <Section title="⚠️ Approval Required">
              <div className="rounded-[18px] border border-[#d8a14a] bg-[#fff6ea] p-4 text-[14px] leading-6 text-[#8a6520]">
                <p className="font-semibold">This task has been submitted for your review.</p>
                <p className="mt-2">The agent is waiting for your approval or feedback before proceeding. Review the output above and approve or request changes below.</p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleApprove(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#2fba82] bg-[#2fba82]/10 px-4 py-2.5 text-[13px] font-semibold text-[#2fba82] transition hover:bg-[#2fba82]/20"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => {
                      const feedback = prompt('Please provide feedback or requested changes:');
                      if (feedback) handleApprove(false, feedback);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d26a61] bg-[#d26a61]/10 px-4 py-2.5 text-[13px] font-semibold text-[#d26a61] transition hover:bg-[#d26a61]/20"
                  >
                    <AlertCircle size={14} /> Request Changes
                  </button>
                </div>
              </div>
            </Section>
          )}

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
                    <div className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-[var(--app-sub)]">
                      <MentionText content={comment.content} />
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="relative mt-4 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Add Comment</p>
              <MentionAutocomplete 
                text={draft} 
                onSelect={(agentName) => {
                  const lastAt = draft.lastIndexOf('@');
                  if (lastAt !== -1) {
                    const newDraft = draft.slice(0, lastAt) + `@${agentName} ` + draft.slice(draft.indexOf(' ', lastAt) !== -1 ? draft.indexOf(' ', lastAt) : draft.length);
                    setDraft(newDraft);
                  }
                }} 
                containerRef={{ current: document.getElementById('comment-textarea') }}
              />
              <textarea
                id="comment-textarea"
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

function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'amber' | 'blue' | 'neutral' | 'purple' }) {
  const className =
    tone === 'green'
      ? 'border-[#2fba82] bg-[#2fba82] text-white'
      : tone === 'amber'
      ? 'border-[#d3aa68] bg-white text-[#b6873b]'
      : tone === 'blue'
      ? 'border-[#4d7ed6] bg-[#4d7ed6] text-white'
      : tone === 'purple'
      ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
      : 'border-[#e8e0d4] bg-[#fbf7f1] text-[#7a7267]';

  return <span className={`rounded-[12px] border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`}>{children}</span>;
}

function GhostTag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-[var(--app-col)] px-3 py-1.5 text-[11px] text-[var(--app-muted)]">{children}</span>;
}

function taskNeedsHighAttention(task: Task, comments: TaskComment[]) {
  return comments.some((comment) => /@navdeep/i.test(comment.content)) || task.status === 'failed';
}