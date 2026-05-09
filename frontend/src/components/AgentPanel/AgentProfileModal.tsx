import { useMemo, useState, type ReactNode } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { addSessionChatMessage } from '../../api/client';
import type { ChatMessage, Task, TaskComment } from '../../types';
import {
  extractMentions,
  formatTimeAgo,
  type AgentCatalogItem,
} from '../MissionControl/dashboardUtils';

interface AgentProfileModalProps {
  agent: AgentCatalogItem;
  sessionId: string | null;
  tasks: Task[];
  comments: Record<string, TaskComment[]>;
  chatMessages: ChatMessage[];
  onClose: () => void;
  onOpenTask: (task: Task) => void;
  onLaunchMission: (goal: string) => Promise<void>;
}

type Tab = 'attention' | 'tasks' | 'timeline' | 'messages';

export function AgentProfileModal({
  agent,
  sessionId,
  tasks,
  comments,
  chatMessages,
  onClose,
  onOpenTask,
  onLaunchMission,
}: AgentProfileModalProps) {
  const [tab, setTab] = useState<Tab>('attention');
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const AgentIcon = agent.icon;

  const agentTasks = useMemo(
    () => (agent.type === 'manager' ? tasks : tasks.filter((task) => task.agent_type === agent.type)),
    [agent.type, tasks]
  );
  const attentionTasks = useMemo(
    () =>
      agentTasks.filter((task) =>
        (comments[task.id] ?? []).some((comment) => {
          const mentions = extractMentions(comment.content);
          return mentions.includes(agent.name.toLowerCase()) || mentions.includes(agent.type.toLowerCase());
        })
      ),
    [agent.name, agent.type, agentTasks, comments]
  );
  const timeline = useMemo(
    () =>
      [...agentTasks]
        .sort((a, b) => (b.completed_at ?? b.started_at ?? b.created_at) - (a.completed_at ?? a.started_at ?? a.created_at)),
    [agentTasks]
  );
  const messages = useMemo(
    () =>
      chatMessages.filter((message) => {
        if (agent.type === 'manager') return true;
        const mentions = extractMentions(message.content);
        return message.agent_type === agent.type || mentions.includes(agent.name.toLowerCase()) || mentions.includes(agent.type.toLowerCase());
      }),
    [agent.type, agent.name, chatMessages]
  );

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      if (agent.isManager) {
        await onLaunchMission(content);
      } else if (sessionId) {
        await addSessionChatMessage(sessionId, {
          agent_type: 'navdeep',
          agent_name: 'Navdeep',
          content: `@${agent.type} ${content}`,
        });
      }
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]">
      <div className="h-full w-full max-w-[620px] overflow-hidden border-l border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[var(--app-accent)]" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]">Agent Profile</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--app-muted)] transition hover:bg-[var(--app-col)] hover:text-[var(--app-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="h-[calc(100%-69px)] overflow-y-auto">
          <div className="flex items-center gap-4 border-b border-[var(--app-border)] px-6 py-6">
            <div className="grid h-16 w-16 place-items-center rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)]">
              <AgentIcon size={24} style={{ color: agent.color }} />
            </div>
            <div>
              <h2 className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-[var(--app-text)]">{agent.name}</h2>
              <p className="mt-2 text-[16px] text-[var(--app-sub)]">{agent.shortRole}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-[12px] border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                  {agent.badge}
                </span>
                <span className="rounded-[12px] border border-[color:var(--app-success)]/30 bg-[color:var(--app-success)]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-success)]">
                  Working
                </span>
              </div>
            </div>
          </div>

          <section className="border-b border-[var(--app-border)] px-6 py-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">About</p>
            <p className="mt-3 text-[14px] leading-7 text-[var(--app-sub)]">{agent.about}</p>
          </section>

          <section className="border-b border-[var(--app-border)] px-6 py-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">Skills</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {agent.skills.map((skill) => (
                <span key={skill} className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[12px] text-[var(--app-sub)]">
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <section className="border-b border-[var(--app-border)] px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <TabButton active={tab === 'attention'} onClick={() => setTab('attention')}>Attention</TabButton>
              <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>Tasks</TabButton>
              <TabButton active={tab === 'timeline'} onClick={() => setTab('timeline')}>Timeline</TabButton>
              <TabButton active={tab === 'messages'} onClick={() => setTab('messages')}>Messages</TabButton>
            </div>
          </section>

          <section className="px-6 py-6">
            {tab === 'attention' && (
              <Panel>
                {attentionTasks.length === 0 ? (
                  <EmptyState>All caught up. No pending mentions or escalations.</EmptyState>
                ) : (
                  attentionTasks.map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} />)
                )}
              </Panel>
            )}

            {tab === 'tasks' && (
              <Panel>
                {agentTasks.length === 0 ? (
                  <EmptyState>No tasks have been routed here yet.</EmptyState>
                ) : (
                  agentTasks.map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} />)
                )}
              </Panel>
            )}

            {tab === 'timeline' && (
              <Panel>
                {timeline.length === 0 ? (
                  <EmptyState>No timeline entries yet.</EmptyState>
                ) : (
                  timeline.map((task) => (
                    <div key={task.id} className="rounded-[22px] border border-[#ebe2d6] bg-white px-5 py-5">
                      <button onClick={() => onOpenTask(task)} className="w-full text-left">
                        <p className="text-[20px] font-semibold text-[#221f1c]">{task.title}</p>
                        <p className="mt-2 text-[15px] leading-7 text-[#7b7469]">{task.description}</p>
                        <p className="mt-3 text-[13px] uppercase tracking-[0.16em] text-[#a49a8d]">
                          {task.status} • {formatTimeAgo(task.completed_at ?? task.started_at ?? task.created_at)}
                        </p>
                      </button>
                    </div>
                  ))
                )}
              </Panel>
            )}

            {tab === 'messages' && (
              <Panel>
                {messages.length === 0 ? (
                  <EmptyState>No direct messages or mentions yet.</EmptyState>
                ) : (
                  messages.map((message) => (
                    <article key={message.id} className="rounded-[22px] border border-[#ebe2d6] bg-white px-5 py-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[18px] font-semibold text-[#221f1c]">{message.agent_name}</p>
                        <span className="text-[13px] text-[#a49a8d]">{formatTimeAgo(message.created_at)}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-[16px] leading-7 text-[#433d36]">{message.content}</p>
                    </article>
                  ))
                )}
              </Panel>
            )}
          </section>

          <section className="border-t border-[var(--app-border)] px-6 py-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              {agent.isManager ? 'Send Mission To Manager' : `Send Message To ${agent.name}`}
            </p>
            <div className="mt-3 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={agent.isManager ? 'Describe the task or mission you want to launch…' : `Message ${agent.name}… (@ to mention)`}
                className="min-h-[96px] w-full resize-none rounded-[16px] border border-[var(--app-border)] bg-[var(--app-col)] px-4 py-3 text-[14px] leading-6 text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-[var(--app-muted)]">
                  {agent.isManager ? 'The manager profile is now the primary place to start new work.' : 'Mention another teammate with @name to coordinate handoffs.'}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={!draft.trim() || submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {agent.isManager ? 'Launch Mission' : 'Send Message'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-6 text-center text-[13px] text-[var(--app-muted)]">
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
        active ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]' : 'bg-[var(--app-col)] text-[var(--app-muted)]'
      }`}
    >
      {children}
    </button>
  );
}

function TaskRow({ task, onOpenTask }: { task: Task; onOpenTask: (task: Task) => void }) {
  return (
    <button
      onClick={() => onOpenTask(task)}
      className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 text-left shadow-[var(--app-shadow-card)] transition hover:-translate-y-px"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[16px] font-semibold leading-snug text-[var(--app-text)]">{task.title}</p>
          <p className="mt-1.5 text-[13px] leading-6 text-[var(--app-sub)]">{task.description}</p>
        </div>
        <span className="whitespace-nowrap text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{task.status}</span>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{formatTimeAgo(task.completed_at ?? task.started_at ?? task.created_at)}</p>
    </button>
  );
}
