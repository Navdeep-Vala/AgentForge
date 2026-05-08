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
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(243,238,230,0.5)] backdrop-blur-[2px]">
      <div className="h-full w-full max-w-[720px] overflow-hidden border-l border-[#e7dece] bg-[#fffdfa] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#eee4d8] px-8 py-6">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#c48a29]" />
            <span className="text-[15px] font-semibold uppercase tracking-[0.28em] text-[#21201e]">Agent Profile</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[#9d9589] transition hover:bg-[#f7f1e8] hover:text-[#21201e]">
            <X size={18} />
          </button>
        </div>

        <div className="h-[calc(100%-88px)] overflow-y-auto">
          <div className="flex items-center gap-5 border-b border-[#eee4d8] px-8 py-10">
            <div className="grid h-[86px] w-[86px] place-items-center rounded-[28px] border border-[#eadfce] bg-white">
              <agent.icon size={32} style={{ color: agent.color }} />
            </div>
            <div>
              <h2 className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-[#191816]">{agent.name}</h2>
              <p className="mt-3 text-[22px] text-[#736b61]">{agent.shortRole}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-[14px] border border-[#eddcc7] bg-[#fff8ef] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#c48a29]">
                  {agent.badge}
                </span>
                <span className="rounded-[16px] border border-[#a7d6c0] bg-[#f1fbf6] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2d9a6e]">
                  Working
                </span>
              </div>
            </div>
          </div>

          <section className="border-b border-[#eee4d8] px-8 py-8">
            <p className="text-[14px] font-semibold uppercase tracking-[0.24em] text-[#aba295]">About</p>
            <p className="mt-4 text-[18px] leading-8 text-[#3f3a35]">{agent.about}</p>
          </section>

          <section className="border-b border-[#eee4d8] px-8 py-8">
            <p className="text-[14px] font-semibold uppercase tracking-[0.24em] text-[#aba295]">Skills</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {agent.skills.map((skill) => (
                <span key={skill} className="rounded-[14px] border border-[#ede4d7] bg-[#fffdfa] px-4 py-2 text-[15px] text-[#6a6257]">
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <section className="border-b border-[#eee4d8] px-8 py-6">
            <div className="flex flex-wrap gap-3">
              <TabButton active={tab === 'attention'} onClick={() => setTab('attention')}>Attention</TabButton>
              <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>Tasks</TabButton>
              <TabButton active={tab === 'timeline'} onClick={() => setTab('timeline')}>Timeline</TabButton>
              <TabButton active={tab === 'messages'} onClick={() => setTab('messages')}>Messages</TabButton>
            </div>
          </section>

          <section className="px-8 py-8">
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

          <section className="border-t border-[#eee4d8] px-8 py-8">
            <p className="text-[14px] font-semibold uppercase tracking-[0.24em] text-[#aba295]">
              {agent.isManager ? 'Send Mission To Manager' : `Send Message To ${agent.name}`}
            </p>
            <div className="mt-4 rounded-[28px] border border-[#e8e0d4] bg-[#fffdfa] p-4">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={agent.isManager ? 'Describe the task or mission you want to launch…' : `Message ${agent.name}… (@ to mention)`}
                className="min-h-[120px] w-full resize-none rounded-[20px] border border-[#ece3d6] bg-[#fbf8f2] px-4 py-3 text-[16px] leading-7 text-[#23211d] outline-none transition focus:border-[#d7b176]"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[13px] text-[#9e9588]">
                  {agent.isManager ? 'The manager profile is now the primary place to start new work.' : 'Mention another teammate with @name to coordinate handoffs.'}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={!draft.trim() || submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[#efc28e] px-5 py-3 text-[14px] font-semibold text-[#fffdfa] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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
  return <div className="space-y-4">{children}</div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#e4dccf] bg-[#fffdf9] px-5 py-8 text-center text-[15px] text-[#a49b90]">
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[15px] font-medium transition ${
        active ? 'bg-[#fff6ea] text-[#b07a2f]' : 'bg-[#f6f0e7] text-[#9f9689]'
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
      className="w-full rounded-[22px] border border-[#ebe2d6] bg-white px-5 py-5 text-left shadow-[0_10px_30px_rgba(196,171,132,0.08)] transition hover:-translate-y-px"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[20px] font-semibold leading-snug text-[#221f1c]">{task.title}</p>
          <p className="mt-2 text-[15px] leading-7 text-[#7b7469]">{task.description}</p>
        </div>
        <span className="whitespace-nowrap text-[13px] uppercase tracking-[0.16em] text-[#a49a8d]">{task.status}</span>
      </div>
      <p className="mt-4 text-[13px] uppercase tracking-[0.16em] text-[#a49a8d]">{formatTimeAgo(task.completed_at ?? task.started_at ?? task.created_at)}</p>
    </button>
  );
}
