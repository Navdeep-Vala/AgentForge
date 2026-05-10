import { useMemo, useState, type ReactNode } from 'react';
import { useFeedStore } from '../../store/feedStore';
import { useSessionStore } from '../../store/sessionStore';
import { formatTimeAgo, getUserMentions } from '../MissionControl/dashboardUtils';
import { MentionText } from '../Notifications/MentionText';

type FeedFilter = 'all' | 'tasks' | 'comments' | 'docs' | 'status';

interface LiveFeedProps {
  onOpenTask: (taskId: string) => void;
  onOpenDocs: () => void;
}

export function LiveFeed({ onOpenTask, onOpenDocs }: LiveFeedProps) {
  const { events } = useFeedStore();
  const { comments, chatMessages, currentSession } = useSessionStore();
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [activeAgent, setActiveAgent] = useState<string>('all');

  const allComments = useMemo(() => Object.values(comments).flat(), [comments]);
  const agentChips = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();

    for (const event of events) {
      if (!event.agentName) continue;
      const key = event.agentName.toLowerCase();
      counts.set(key, { name: event.agentName, count: (counts.get(key)?.count ?? 0) + 1 });
    }

    for (const message of chatMessages) {
      const key = message.agent_name.toLowerCase();
      counts.set(key, { name: message.agent_name, count: (counts.get(key)?.count ?? 0) + 1 });
    }

    return Array.from(counts.entries()).map(([key, value]) => ({ key, ...value }));
  }, [events, chatMessages]);

  const feedItems = useMemo(() => {
    const combined = [
      ...events.map((event) => ({
        id: event.id,
        type: event.type,
        content: event.message,
        agent: event.agentName ?? 'System',
        created_at: event.timestamp,
        taskId: event.taskId,
        color: event.agentColor,
      })),
      ...getUserMentions(chatMessages, comments).map((mention) => ({
        id: `mention-${mention.id}`,
        type: mention.source,
        content: mention.content,
        agent: mention.agent_name,
        created_at: mention.created_at,
        taskId: mention.task_id,
        color: undefined,
      })),
      ...allComments.map((comment) => ({
        id: `comment-${comment.id}`,
        type: 'comment',
        content: comment.content,
        agent: comment.agent_name,
        created_at: comment.created_at,
        taskId: comment.task_id,
        color: undefined,
      })),
    ].sort((a, b) => b.created_at - a.created_at);

    return combined.filter((item) => {
      if (activeAgent !== 'all' && item.agent.toLowerCase() !== activeAgent) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'tasks') return item.type.includes('task') || item.type === 'manager_working';
      if (activeFilter === 'comments') return item.type === 'comment' || item.type === 'chat_message';
      if (activeFilter === 'docs') return /doc|deliverable|file|report/i.test(item.content);
      if (activeFilter === 'status') return /running|done|paused|active|complete|failed/i.test(item.content);
      return true;
    });
  }, [activeAgent, activeFilter, allComments, chatMessages, comments, events]);

  return (
    <aside className="w-[300px] shrink-0 border-l border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="border-b border-[var(--app-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[var(--app-success)]" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]">Live Feed</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', 'tasks', 'comments', 'docs', 'status'] as FeedFilter[]).map((filter) => (
            <Pill
              key={filter}
              active={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </Pill>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Pill active={activeAgent === 'all'} onClick={() => setActiveAgent('all')}>All Agents</Pill>
          {agentChips.map((chip) => (
            <Pill key={chip.key} active={activeAgent === chip.key} onClick={() => setActiveAgent(chip.key)}>
              {chip.name} {chip.count}
            </Pill>
          ))}
        </div>
      </div>

      <div className="h-[calc(100vh-148px)] overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {feedItems.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-7 text-center text-[13px] text-[var(--app-muted)]">
              Activity will appear here as the squad collaborates.
            </div>
          ) : (
            feedItems.map((item) => (
              <article 
                key={item.id} 
                onClick={() => {
                  if (item.taskId) onOpenTask(item.taskId);
                  else if (item.type === 'session_complete' || /doc|report|deliverable/i.test(item.content)) onOpenDocs();
                }}
                className={`rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 shadow-[var(--app-shadow-card)] transition ${(item.taskId || item.type === 'session_complete' || /doc|report|deliverable/i.test(item.content)) ? 'cursor-pointer hover:border-[var(--app-accent)] hover:shadow-[var(--app-shadow-card-md)]' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span 
                    className="mt-1.5 h-2 w-2 rounded-full" 
                    style={{ backgroundColor: item.color || 'var(--app-muted)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold leading-tight text-[var(--app-text)]">
                        {item.agent}
                      </p>
                      {item.type === 'status' && (
                        <span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--app-accent)]">
                          System
                        </span>
                      )}
                    </div>
                    {item.content.startsWith('Thought:') ? (
                      <div className="mt-1.5 text-[13px] leading-relaxed text-[var(--app-sub)] italic border-l-2 border-[var(--app-accent)] pl-2">
                        <MentionText content={item.content.replace('Thought: ', '')} />
                      </div>
                    ) : item.type === 'file_changed' && item.content.startsWith('File created:') ? (
                      <div className="mt-1.5 text-[13px] leading-relaxed text-[var(--app-sub)]">
                        File created:{' '}
                        <a 
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/sessions/${currentSession?.id}/workspace/${item.content.replace('File created: ', '').split('/').map(part => encodeURIComponent(part)).join('/')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--app-accent)] hover:underline inline-flex items-center gap-1 mt-1 bg-[var(--app-surface-hover)] px-2 py-1 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Download {item.content.split('/').pop()}
                        </a>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-[13px] leading-relaxed text-[var(--app-sub)]">
                        <MentionText content={item.content} />
                      </div>
                    )}
                    <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] font-bold">{formatTimeAgo(item.created_at)}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
        active ? 'border-[var(--app-accent)] bg-[var(--app-surface)] text-[var(--app-accent)]' : 'border-[var(--app-border)] bg-[var(--app-col)] text-[var(--app-sub)]'
      }`}
    >
      {children}
    </button>
  );
}
