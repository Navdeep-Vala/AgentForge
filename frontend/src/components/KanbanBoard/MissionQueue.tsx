import { useMemo, useState } from 'react';
import { BriefcaseBusiness } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import type { Task } from '../../types';
import { getMentionedTaskIds, getMissionLane } from '../MissionControl/dashboardUtils';
import { KanbanColumn } from './KanbanColumn';

const FILTERS = ['all', 'images', 'inbox', 'assigned', 'active', 'review', 'done', 'blocked'] as const;
type QueueFilter = (typeof FILTERS)[number];

interface MissionQueueProps {
  onOpenTask: (task: Task) => void;
}

export function MissionQueue({ onOpenTask }: MissionQueueProps) {
  const { currentSession, comments } = useSessionStore();
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');
  const tasks = currentSession?.tasks ?? [];

  const mentionedTaskIds = useMemo(() => new Set(getMentionedTaskIds(comments)), [comments]);
  const columns = useMemo(
    () => ({
      inbox: tasks.filter((task) => getMissionLane(task, comments) === 'inbox'),
      assigned: tasks.filter((task) => getMissionLane(task, comments) === 'assigned'),
      in_progress: tasks.filter((task) => getMissionLane(task, comments) === 'in_progress'),
      review: tasks.filter((task) => getMissionLane(task, comments) === 'review'),
      done: tasks.filter((task) => getMissionLane(task, comments) === 'done'),
      blocked: tasks.filter((task) => getMissionLane(task, comments) === 'blocked'),
      navdeep: tasks.filter((task) => getMissionLane(task, comments) === 'navdeep'),
    }),
    [tasks, comments]
  );

  const filteredColumns = useMemo(() => {
    const matchesFilter = (task: Task) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'images') return /image|design|ui|visual/i.test(`${task.title} ${task.description}`);
      if (activeFilter === 'inbox') return getMissionLane(task, comments) === 'inbox';
      if (activeFilter === 'assigned') return getMissionLane(task, comments) === 'assigned';
      if (activeFilter === 'active') return getMissionLane(task, comments) === 'in_progress';
      if (activeFilter === 'review') return getMissionLane(task, comments) === 'review';
      if (activeFilter === 'done') return getMissionLane(task, comments) === 'done';
      if (activeFilter === 'blocked') return getMissionLane(task, comments) === 'blocked';
      return true;
    };

    return {
      inbox: columns.inbox.filter(matchesFilter),
      assigned: columns.assigned.filter(matchesFilter),
      in_progress: columns.in_progress.filter(matchesFilter),
      review: columns.review.filter(matchesFilter),
      done: columns.done.filter(matchesFilter),
      blocked: columns.blocked.filter(matchesFilter),
      navdeep: columns.navdeep.filter(matchesFilter),
    };
  }, [activeFilter, columns, comments, mentionedTaskIds]);

  return (
    <main className="min-w-0 flex-1 flex flex-col bg-[var(--app-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[var(--app-accent)]" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]">Mission Queue</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-[10px] bg-[var(--app-col)] px-2.5 py-1 text-[12px] text-[var(--app-muted)]">
            {tasks.length}
          </span>
          <span className="rounded-[10px] bg-[var(--app-col)] px-2.5 py-1 text-[12px] text-[var(--app-muted)]">
            {columns.in_progress.length} active
          </span>
        </div>
      </div>

      <div className="border-b border-[var(--app-border)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-[14px] border px-3.5 py-2 text-[13px] font-medium capitalize transition ${
                activeFilter === filter
                  ? 'border-[var(--app-accent)] bg-[var(--app-surface)] text-[var(--app-accent)]'
                  : 'border-[var(--app-border)] bg-[var(--app-col)] text-[var(--app-sub)]'
              }`}
            >
              {filter}
            </button>
          ))}
          <button className="ml-auto grid h-10 w-10 place-items-center rounded-[14px] bg-[var(--app-col)] text-[var(--app-sub)]">
            <BriefcaseBusiness size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-w-0 overflow-x-auto pb-6 custom-scrollbar h-0">
        <KanbanColumn title="Inbox" dotColor="#bbb6af" tasks={filteredColumns.inbox} comments={comments} onOpenTask={onOpenTask} />
        <KanbanColumn title="Assigned" dotColor="#c48a29" tasks={filteredColumns.assigned} comments={comments} onOpenTask={onOpenTask} />
        <KanbanColumn title="In Progress" dotColor="#2d9a6e" tasks={filteredColumns.in_progress} comments={comments} onOpenTask={onOpenTask} />
        <KanbanColumn title="Review" dotColor="#4d7ed6" tasks={filteredColumns.review} comments={comments} onOpenTask={onOpenTask} />
        <KanbanColumn title="Done" dotColor="#2d9a6e" tasks={filteredColumns.done} comments={comments} onOpenTask={onOpenTask} />
        <KanbanColumn title="Blocked" dotColor="#ef4444" tasks={filteredColumns.blocked} comments={comments} onOpenTask={onOpenTask} />
        <KanbanColumn title="Navdeep" dotColor="#d8a14a" tasks={filteredColumns.navdeep} comments={comments} onOpenTask={onOpenTask} />
      </div>
    </main>
  );
}
