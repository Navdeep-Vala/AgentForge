import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { addSessionChatMessage } from '../../api/client';
import type { ChatMessage } from '../../types';
import { formatTimeAgo } from '../MissionControl/dashboardUtils';
import { MentionAutocomplete } from '../Notifications/MentionAutocomplete';
import { MentionText } from '../Notifications/MentionText';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSessionStore } from '../../store/sessionStore';

interface SquadChatModalProps {
  sessionId: string | null;
  messages: ChatMessage[];
  onClose: () => void;
}

export function SquadChatModal({ sessionId, messages, onClose }: SquadChatModalProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const orderedMessages = useMemo(() => [...messages].sort((a, b) => a.created_at - b.created_at), [messages]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderedMessages]);

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || !sessionId || submitting) return;
    setSubmitting(true);
    try {
      await addSessionChatMessage(sessionId, {
        agent_type: 'navdeep',
        agent_name: 'Navdeep',
        content,
      });
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMentionSelect = (agentName: string) => {
    const lastAt = draft.lastIndexOf('@');
    if (lastAt !== -1) {
      const newDraft = draft.slice(0, lastAt) + `@${agentName} ` + draft.slice(draft.indexOf(' ', lastAt) !== -1 ? draft.indexOf(' ', lastAt) : draft.length);
      setDraft(newDraft);
      textAreaRef.current?.focus();
    }
  };

  return (
    <Shell title="Squad Chat" onClose={onClose}>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        {orderedMessages.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-6 text-center text-[13px] text-[var(--app-muted)]">
            Squad chat is quiet right now.
          </p>
        ) : (
          orderedMessages.map((message) => (
            <article key={message.id} className="rounded-[18px] bg-[var(--app-col)] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--app-accent)] text-xs font-semibold text-white">
                  {message.agent_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--app-text)]">{message.agent_name}</p>
                  <p className="text-[11px] text-[var(--app-muted)]">{formatTimeAgo(message.created_at)}</p>
                </div>
              </div>
              <div className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-[var(--app-sub)]">
                <MentionText content={message.content} />
              </div>
            </article>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative mt-5 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm">
        <MentionAutocomplete 
          text={draft} 
          onSelect={handleMentionSelect} 
          containerRef={textAreaRef}
        />
        <textarea
          ref={textAreaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the squad... Use @name to direct a teammate."
          className="min-h-[96px] w-full resize-none rounded-[16px] border border-[var(--app-border)] bg-[var(--app-col)] px-4 py-3 text-[14px] leading-6 text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
        />
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={handleSubmit}
            disabled={!draft.trim() || !sessionId || submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </div>
    </Shell>
  );
}

interface BroadcastModalProps {
  sessionId: string | null;
  onClose: () => void;
}

export function BroadcastModal({ sessionId, onClose }: BroadcastModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const content = body.trim();
    if (!content || !sessionId || submitting) return;
    setSubmitting(true);
    try {
      const header = title.trim() ? `Broadcast: ${title.trim()}` : 'Broadcast';
      const priorityLine = priority === 'urgent' ? '[URGENT]' : '[NORMAL]';
      await addSessionChatMessage(sessionId, {
        agent_type: 'navdeep',
        agent_name: 'Navdeep',
        content: `${priorityLine} ${header}\n\n${content}`,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell title="Squad Announcement" onClose={onClose}>
      <div className="space-y-5">
        <Field label="Title (optional)">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Strategic Direction Change"
            className="h-14 w-full rounded-[16px] border border-[var(--app-border)] bg-[var(--app-col)] px-4 text-[15px] text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
          />
        </Field>

        <Field label="Message *">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your announcement to the squad..."
            className="min-h-[160px] w-full resize-none rounded-[16px] border border-[var(--app-border)] bg-[var(--app-col)] px-4 py-3 text-[15px] leading-7 text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)]"
          />
        </Field>

        <Field label="Priority">
          <div className="flex gap-3">
            <PriorityButton active={priority === 'normal'} onClick={() => setPriority('normal')}>Normal</PriorityButton>
            <PriorityButton active={priority === 'urgent'} onClick={() => setPriority('urgent')}>Urgent</PriorityButton>
          </div>
        </Field>

        <div className="flex justify-end gap-3 border-t border-[var(--app-border)] pt-5">
          <button onClick={onClose} className="rounded-full border border-[var(--app-border)] px-4 py-2.5 text-[13px] text-[var(--app-sub)]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!body.trim() || !sessionId || submitting}
            className="rounded-full bg-[var(--app-accent)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Broadcasting…' : 'Broadcast To Squad'}
          </button>
        </div>
      </div>
    </Shell>
  );
}


export function DocsModal({ onClose }: { onClose: () => void }) {
  const { currentSession } = useSessionStore();
  const docs = [
    'README.md',
    'PRD-AgentForge.md',
    'docs/superpowers/specs/2026-05-06-project-dashboard-design.md',
    'docs/superpowers/plans/2026-05-06-project-dashboard.md',
  ];

  return (
    <Shell title="Docs & Reports" onClose={onClose}>
      <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        {currentSession?.final_report && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent)]">Mission Final Report</h3>
              <span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-accent)]">Ready</span>
            </div>
            <div className="rounded-[24px] border border-[var(--app-accent)]/30 bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="prose prose-sm prose-invert max-w-none text-[14px] leading-7 text-[var(--app-sub)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentSession.final_report}</ReactMarkdown>
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--app-muted)]">Project Documentation</h3>
          <div className="space-y-3">
            {docs.map((doc) => (
              <div key={doc} className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-col)] px-4 py-4">
                <p className="text-[15px] font-semibold text-[var(--app-text)]">{doc}</p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--app-sub)]">
                  Available in the workspace for product, mission, and implementation context.
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Shell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div 
      className="fixed inset-0 z-50 grid place-items-center bg-black/20 backdrop-blur-[2px] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl rounded-[32px] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-2xl overflow-hidden">
        <div className="bg-[var(--app-col)] rounded-[28px] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--app-text)]">{title}</h2>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-muted)] mt-1">Internal Agent Communications Hub</p>
            </div>
            <button onClick={onClose} className="rounded-full bg-[var(--app-surface)] p-2 text-[var(--app-muted)] shadow-sm transition hover:text-[var(--app-text)]">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">{label}</p>
      {children}
    </label>
  );
}

function PriorityButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[14px] border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${
        active ? 'border-[var(--app-accent)] bg-[var(--app-surface)] text-[var(--app-accent)]' : 'border-[var(--app-border)] bg-[var(--app-col)] text-[var(--app-muted)]'
      }`}
    >
      {children}
    </button>
  );
}
