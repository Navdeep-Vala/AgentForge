import { useSessionStore } from '../../store/sessionStore';
import { useAgentStore } from '../../store/agentStore';
import { useEffect } from 'react';

const BUILT_IN_AGENTS = [
  { type: 'researcher', name: 'Researcher', role: 'Research Specialist', tag: 'RES', color: '#3B82F6', initials: 'RS' },
  { type: 'coder',      name: 'Coder',      role: 'Full-Stack Engineer', tag: 'COD', color: '#10B981', initials: 'CD' },
  { type: 'tester',     name: 'Tester',     role: 'QA Engineer',         tag: 'QA',  color: '#F59E0B', initials: 'QA' },
  { type: 'rnd',        name: 'R&D Analyst',role: 'Competitive Intel',   tag: 'RND', color: '#8B5CF6', initials: 'RD' },
] as const;

export function AgentSidebar() {
  const { currentSession } = useSessionStore();
  const { agents: customAgents, fetchAgents } = useAgentStore();
  const tasks = currentSession?.tasks ?? [];

  useEffect(() => { fetchAgents(); }, []);

  const getStatus = (type: string): 'working' | 'idle' | 'done' => {
    const agentTasks = tasks.filter(t => t.agent_type === type);
    if (agentTasks.some(t => t.status === 'in_progress')) return 'working';
    if (agentTasks.length > 0 && agentTasks.every(t => t.status === 'done' || t.status === 'failed' || t.status === 'cancelled')) return 'done';
    return 'idle';
  };

  const getCurrentTask = (type: string) =>
    tasks.find(t => t.agent_type === type && t.status === 'in_progress')?.title;

  const customVisible = customAgents.filter(a => !a.is_builtin);

  return (
    <aside className="w-52 flex-shrink-0 bg-app-surface border-r border-app-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
        <span className="text-[10px] font-semibold text-app-muted uppercase tracking-widest">Agents</span>
        <span className="text-[9px] font-bold text-app-sub bg-app-col rounded-full w-5 h-5 flex items-center justify-center border border-app-border">
          {BUILT_IN_AGENTS.length + customVisible.length}
        </span>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto py-1">
        {BUILT_IN_AGENTS.map(agent => (
          <AgentItem
            key={agent.type}
            initials={agent.initials}
            name={agent.name}
            role={agent.role}
            tag={agent.tag}
            color={agent.color}
            status={getStatus(agent.type)}
            currentTask={getCurrentTask(agent.type)}
          />
        ))}

        {customVisible.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1">
              <div className="h-px bg-app-border" />
              <p className="text-[9px] text-app-muted uppercase tracking-widest mt-2">Custom</p>
            </div>
            {customVisible.map(agent => (
              <AgentItem
                key={agent.type}
                initials={agent.name.slice(0, 2).toUpperCase()}
                name={agent.name}
                role={agent.description}
                tag="CST"
                color={agent.color}
                status={getStatus(agent.type)}
                currentTask={getCurrentTask(agent.type)}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

interface AgentItemProps {
  initials: string;
  name: string;
  role: string;
  tag: string;
  color: string;
  status: 'working' | 'idle' | 'done';
  currentTask?: string;
}

function AgentItem({ initials, name, role, tag, color, status, currentTask }: AgentItemProps) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-app-col transition-colors cursor-default">
      {/* Avatar with ring */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
          style={{ backgroundColor: color, outline: `2px solid ${color}50`, outlineOffset: '2px' }}
        >
          {initials}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-app-surface ${
            status === 'working' ? 'bg-emerald-500 animate-pulse' :
            status === 'done'    ? 'bg-app-muted' :
            'bg-app-border'
          }`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-app-text truncate">{name}</span>
          <span
            className="text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {tag}
          </span>
        </div>
        <p className="text-[9px] text-app-muted truncate leading-none mt-0.5">{role}</p>
        {status === 'working' && currentTask ? (
          <p className="text-[9px] text-emerald-500 truncate mt-1 leading-none">{currentTask}</p>
        ) : (
          <span className={`inline-block text-[9px] font-medium uppercase tracking-wide mt-1 ${
            status === 'done' ? 'text-app-muted' : 'text-app-muted'
          }`}>
            {status === 'done' ? 'Done' : 'Idle'}
          </span>
        )}
      </div>
    </div>
  );
}
