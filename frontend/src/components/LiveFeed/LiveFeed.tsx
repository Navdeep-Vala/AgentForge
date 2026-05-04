import { useFeedStore, FeedEvent } from '../../store/feedStore';
import { CheckCircle2, AlertCircle, Play, Trophy, Zap, LucideIcon } from 'lucide-react';

const EVENT_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  task_started:    { icon: Play,         color: 'text-blue-500',    label: 'Started'  },
  task_completed:  { icon: CheckCircle2, color: 'text-emerald-500', label: 'Done'     },
  task_failed:     { icon: AlertCircle,  color: 'text-red-500',     label: 'Failed'   },
  task_comment:    { icon: Zap,          color: 'text-purple-400',  label: 'Comment'  },
  chat_message:    { icon: Zap,          color: 'text-indigo-400',  label: 'Chat'     },
  task_spawned:    { icon: Zap,          color: 'text-orange-400',  label: 'Spawned'  },
  session_complete:{ icon: Trophy,       color: 'text-amber-500',   label: 'Complete' },
  session_started: { icon: Zap,          color: 'text-indigo-500',  label: 'Started'  },
  error:           { icon: AlertCircle,  color: 'text-red-500',     label: 'Error'    },
};

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}

export function LiveFeed() {
  const { events } = useFeedStore();

  return (
    <aside className="w-60 flex-shrink-0 bg-app-surface border-l border-app-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-app-muted uppercase tracking-widest">Activity</span>
          {events.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-app-muted tabular-nums">{events.length}</span>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="w-9 h-9 rounded-lg bg-app-col border border-app-border flex items-center justify-center">
              <Zap size={14} className="text-app-muted" />
            </div>
            <p className="text-[10px] text-app-muted">Activity will appear here as agents work</p>
          </div>
        ) : (
          <ul>
            {events.map(event => (
              <FeedItem key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function FeedItem({ event }: { event: FeedEvent }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <li className="flex gap-2.5 px-3 py-2.5 hover:bg-app-col transition-colors border-b border-app-border/50 last:border-0">
      {/* Icon dot */}
      <div className="flex-shrink-0 mt-1">
        <Icon size={11} className={config.color} />
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
    </li>
  );
}
