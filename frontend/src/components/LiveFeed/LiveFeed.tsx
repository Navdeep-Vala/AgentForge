import { useState, useRef, useEffect } from 'react';
import { useFeedStore, FeedEvent } from '../../store/feedStore';
import { useSessionStore } from '../../store/sessionStore';
import {
  CheckCircle2, AlertCircle, Play, Trophy, Zap, MessageSquare,
  X, LucideIcon, ChevronRight,
} from 'lucide-react';

// ─── Event styling config ─────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string; bg: string }> = {
  task_started:    { icon: Play,         color: 'text-blue-500',    label: 'Started',  bg: 'bg-blue-500/10'    },
  task_completed:  { icon: CheckCircle2, color: 'text-emerald-500', label: 'Done',     bg: 'bg-emerald-500/10' },
  task_failed:     { icon: AlertCircle,  color: 'text-red-500',     label: 'Failed',   bg: 'bg-red-500/10'     },
  task_comment:    { icon: MessageSquare, color: 'text-purple-400', label: 'Comment',  bg: 'bg-purple-400/10'  },
  chat_message:    { icon: MessageSquare, color: 'text-indigo-400', label: 'Chat',     bg: 'bg-indigo-400/10'  },
  task_spawned:    { icon: Zap,          color: 'text-orange-400',  label: 'Spawned',  bg: 'bg-orange-400/10'  },
  session_complete:{ icon: Trophy,       color: 'text-amber-500',   label: 'Complete', bg: 'bg-amber-500/10'   },
  session_started: { icon: Zap,          color: 'text-indigo-500',  label: 'Started',  bg: 'bg-indigo-500/10'  },
  manager_working: { icon: Zap,          color: 'text-pink-500',    label: 'Manager',  bg: 'bg-pink-500/10'    },
  error:           { icon: AlertCircle,  color: 'text-red-500',     label: 'Error',    bg: 'bg-red-500/10'     },
};

const AGENT_COLORS: Record<string, string> = {
  researcher: '#3B82F6',
  coder: '#10B981',
  tester: '#F59E0B',
  rnd: '#8B5CF6',
  manager: '#F97316',
};

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'activity' | 'chat';

export function LiveFeed() {
  const { events } = useFeedStore();
  const { chatMessages, comments } = useSessionStore();
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null);

  const allComments = Object.values(comments).flat();

  // Merge chat messages + task comments into a single timeline for the chat view
  const chatTimeline = [
    ...chatMessages.map(m => ({
      id: m.id,
      agentName: m.agent_name,
      agentType: m.agent_type,
      content: m.content,
      type: 'chat' as const,
      timestamp: m.created_at,
    })),
    ...allComments.map(c => ({
      id: c.id,
      agentName: c.agent_name,
      agentType: c.agent_type,
      content: c.content,
      type: c.comment_type as string,
      timestamp: c.created_at,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <aside className="w-72 flex-shrink-0 bg-app-surface border-l border-app-border flex flex-col overflow-hidden">
      {/* Tab header */}
      <div className="flex items-center border-b border-app-border">
        <TabButton
          active={activeTab === 'activity'}
          onClick={() => setActiveTab('activity')}
          label="Activity"
          count={events.length}
        />
        <TabButton
          active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
          label="Team Chat"
          count={chatTimeline.length}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'activity' ? (
          <ActivityView events={events} onSelect={setSelectedEvent} />
        ) : (
          <ChatView timeline={chatTimeline} />
        )}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </aside>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors border-b-2 ${
        active
          ? 'text-app-text border-app-text'
          : 'text-app-muted border-transparent hover:text-app-sub'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
          active ? 'bg-app-text text-app-surface' : 'bg-app-col text-app-muted'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Activity view (clickable feed items) ─────────────────────────────────────

function ActivityView({ events, onSelect }: { events: FeedEvent[]; onSelect: (e: FeedEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
        <div className="w-9 h-9 rounded-lg bg-app-col border border-app-border flex items-center justify-center">
          <Zap size={14} className="text-app-muted" />
        </div>
        <p className="text-[10px] text-app-muted">Activity will appear here as agents work</p>
      </div>
    );
  }

  return (
    <ul>
      {events.map(event => (
        <FeedItem key={event.id} event={event} onClick={() => onSelect(event)} />
      ))}
    </ul>
  );
}

function FeedItem({ event, onClick }: { event: FeedEvent; onClick: () => void }) {
  const config = EVENT_CONFIG[event.type];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <li
      onClick={onClick}
      className="flex gap-2.5 px-3 py-2.5 hover:bg-app-col transition-colors border-b border-app-border/50 last:border-0 cursor-pointer group"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center ${config.bg}`}>
        <Icon size={10} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          {event.agentName ? (
            <span className="text-[10px] font-semibold text-app-text truncate">{event.agentName}</span>
          ) : (
            <span className={`text-[9px] font-bold uppercase tracking-wider ${config.color}`}>{config.label}</span>
          )}
          <span className="text-[9px] text-app-muted flex-shrink-0 tabular-nums">{timeAgo(event.timestamp)}</span>
        </div>
        <p className="text-[10px] text-app-sub leading-snug mt-0.5 line-clamp-2">{event.message}</p>
      </div>

      {/* Click indicator */}
      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={10} className="text-app-muted" />
      </div>
    </li>
  );
}

// ─── Chat view (team collaboration) ───────────────────────────────────────────

interface ChatEntry {
  id: string;
  agentName: string;
  agentType: string;
  content: string;
  type: string;
  timestamp: number;
}

function ChatView({ timeline }: { timeline: ChatEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
        <div className="w-9 h-9 rounded-lg bg-app-col border border-app-border flex items-center justify-center">
          <MessageSquare size={14} className="text-app-muted" />
        </div>
        <p className="text-[10px] text-app-muted">Agent conversations will appear here</p>
        <p className="text-[9px] text-app-muted">Agents review each other's work and post insights</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {timeline.map(entry => (
        <ChatBubble key={entry.id} entry={entry} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatBubble({ entry }: { entry: ChatEntry }) {
  const color = AGENT_COLORS[entry.agentType] ?? '#6B7280';
  const initials = entry.agentName.slice(0, 2).toUpperCase();
  const isComment = entry.type !== 'chat';

  const commentBadge = isComment ? (
    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {entry.type}
    </span>
  ) : null;

  return (
    <div className="flex gap-2 py-2 px-1">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold mt-0.5"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-semibold text-app-text">{entry.agentName}</span>
          {commentBadge}
          <span className="text-[9px] text-app-muted tabular-nums ml-auto">{timeAgo(entry.timestamp)}</span>
        </div>
        <div className="text-[10px] text-app-sub leading-relaxed whitespace-pre-wrap break-words">
          {entry.content.length > 500
            ? <ExpandableText text={entry.content} />
            : entry.content
          }
        </div>
      </div>
    </div>
  );
}

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {expanded ? text : text.slice(0, 500) + '…'}
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-[9px] font-semibold text-blue-400 hover:text-blue-300 ml-1"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </>
  );
}

// ─── Event detail modal ───────────────────────────────────────────────────────

function EventDetailModal({ event, onClose }: { event: FeedEvent; onClose: () => void }) {
  const config = EVENT_CONFIG[event.type];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.bg}`}>
              <Icon size={14} className={config.color} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-app-text">
                {event.agentName ?? config.label}
              </p>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${config.color}`}>{config.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-app-muted tabular-nums">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <button onClick={onClose} className="p-1 rounded hover:bg-app-col transition-colors">
              <X size={14} className="text-app-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          <p className="text-[12px] text-app-text leading-relaxed whitespace-pre-wrap break-words">
            {event.message}
          </p>
        </div>

        {/* Footer with agent color bar */}
        {event.agentColor && (
          <div className="h-1" style={{ backgroundColor: event.agentColor }} />
        )}
      </div>
    </div>
  );
}
