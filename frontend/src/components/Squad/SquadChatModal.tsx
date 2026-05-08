import { useMemo, useState, type ReactNode } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { addSessionChatMessage } from '../../api/client';
import type { ChatMessage } from '../../types';
import { formatTimeAgo } from '../MissionControl/dashboardUtils';

interface SquadChatModalProps {
  sessionId: string | null;
  messages: ChatMessage[];
  onClose: () => void;
}

export function SquadChatModal({ sessionId, messages, onClose }: SquadChatModalProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const orderedMessages = useMemo(() => [...messages].sort((a, b) => a.created_at - b.created_at), [messages]);

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

  return (
    <Shell title="Squad Chat" onClose={onClose}>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
        {orderedMessages.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-[#e4dccf] bg-[#fffdf9] px-5 py-8 text-center text-[15px] text-[#a49b90]">
            Squad chat is quiet right now.
          </p>
        ) : (
          orderedMessages.map((message) => (
            <article key={message.id} className="rounded-[24px] bg-[#fbf7f1] px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f3c08d] text-sm font-semibold text-white">
                  {message.agent_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[18px] font-semibold text-[#231f1a]">{message.agent_name}</p>
                  <p className="text-[13px] text-[#a49a8d]">{formatTimeAgo(message.created_at)}</p>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-[16px] leading-7 text-[#433d36]">{message.content}</p>
            </article>
          ))
        )}
      </div>

      <div className="mt-6 rounded-[28px] border border-[#e8e0d4] bg-[#fffdfa] p-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the squad... Use @name to direct a teammate."
          className="min-h-[120px] w-full resize-none rounded-[20px] border border-[#ece3d6] bg-[#fbf8f2] px-4 py-3 text-[16px] leading-7 text-[#23211d] outline-none transition focus:border-[#d7b176]"
        />
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={handleSubmit}
            disabled={!draft.trim() || !sessionId || submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[#efc28e] px-5 py-3 text-[14px] font-semibold text-[#fffdfa] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="space-y-6">
        <Field label="Title (optional)">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Strategic Direction Change"
            className="h-16 w-full rounded-[20px] border border-[#ece3d6] bg-[#fbf8f2] px-5 text-[18px] text-[#231f1a] outline-none transition focus:border-[#d7b176]"
          />
        </Field>

        <Field label="Message *">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your announcement to the squad..."
            className="min-h-[180px] w-full resize-none rounded-[20px] border border-[#ece3d6] bg-[#fbf8f2] px-5 py-4 text-[18px] leading-8 text-[#231f1a] outline-none transition focus:border-[#d7b176]"
          />
        </Field>

        <Field label="Priority">
          <div className="flex gap-3">
            <PriorityButton active={priority === 'normal'} onClick={() => setPriority('normal')}>Normal</PriorityButton>
            <PriorityButton active={priority === 'urgent'} onClick={() => setPriority('urgent')}>Urgent</PriorityButton>
          </div>
        </Field>

        <div className="flex justify-end gap-3 border-t border-[#eee4d8] pt-6">
          <button onClick={onClose} className="rounded-full border border-[#ece3d6] px-5 py-3 text-[15px] text-[#7d7568]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!body.trim() || !sessionId || submitting}
            className="rounded-full bg-[#efc28e] px-5 py-3 text-[15px] font-semibold text-[#fffdfa] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Broadcasting…' : 'Broadcast To Squad'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

export function DocsModal({ onClose }: { onClose: () => void }) {
  const docs = [
    'README.md',
    'PRD-AgentForge.md',
    'docs/superpowers/specs/2026-05-06-project-dashboard-design.md',
    'docs/superpowers/plans/2026-05-06-project-dashboard.md',
  ];

  return (
    <Shell title="Docs" onClose={onClose}>
      <div className="space-y-4">
        {docs.map((doc) => (
          <div key={doc} className="rounded-[22px] border border-[#ebe2d6] bg-[#fbf7f1] px-5 py-5">
            <p className="text-[18px] font-semibold text-[#231f1a]">{doc}</p>
            <p className="mt-2 text-[15px] leading-7 text-[#7b7469]">
              Available in the workspace for product, mission, and implementation context.
            </p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(243,238,230,0.5)] backdrop-blur-[2px] p-6">
      <div className="w-full max-w-4xl rounded-[36px] border border-[#eadfce] bg-[#fffdfa] p-8 shadow-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-[36px] font-semibold tracking-[-0.04em] text-[#231f1a]">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-[#9d9589] transition hover:bg-[#f7f1e8] hover:text-[#21201e]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <p className="mb-3 text-[14px] font-semibold uppercase tracking-[0.24em] text-[#aba295]">{label}</p>
      {children}
    </label>
  );
}

function PriorityButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[18px] border px-5 py-3 text-[15px] font-semibold uppercase tracking-[0.12em] ${
        active ? 'border-[#d3aa68] bg-white text-[#b6873b]' : 'border-[#ece3d6] bg-[#fbf8f2] text-[#b1a89b]'
      }`}
    >
      {children}
    </button>
  );
}
