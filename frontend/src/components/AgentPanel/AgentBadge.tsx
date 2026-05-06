import type { LucideIcon } from 'lucide-react';
import { Search, Code2, TestTube, BarChart2, Bot } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Search,
  Code2,
  TestTube,
  BarChart2,
  Bot,
};

interface AgentBadgeProps {
  name: string;
  color: string;
  icon: string;
  status: 'idle' | 'working' | 'done';
  currentTask?: string;
}

export function AgentBadge({ name, color, icon, status, currentTask }: AgentBadgeProps) {
  const Icon = ICON_MAP[icon] ?? Bot;

  return (
    <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 min-w-44">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative"
        style={{ backgroundColor: `${color}22`, border: `1.5px solid ${color}44` }}
      >
        <Icon size={16} style={{ color }} />
        {status === 'working' && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
        )}
        {status === 'done' && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gray-500" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{name}</p>
        <p className="text-xs truncate" style={{ color: status === 'working' ? color : '#6B7280' }}>
          {status === 'idle' && 'Idle'}
          {status === 'working' && (currentTask ? `Working on: ${currentTask}` : 'Thinking...')}
          {status === 'done' && 'Done'}
        </p>
      </div>
    </div>
  );
}
