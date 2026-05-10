import { useEffect, useMemo } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { useAgentStore } from '../../store/agentStore';
import { getAgentCatalog, getAgentStatus, type AgentCatalogItem } from '../MissionControl/dashboardUtils';

interface AgentSidebarProps {
  selectedAgentType: string | null;
  onSelectAgent: (agent: AgentCatalogItem) => void;
}

export function AgentSidebar({ selectedAgentType, onSelectAgent }: AgentSidebarProps) {
  const { currentSession } = useSessionStore();
  const { agents, fetchAgents } = useAgentStore();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const catalog = useMemo(() => getAgentCatalog(agents, currentSession), [agents, currentSession]);
  const activeCount = useMemo(
    () => catalog.filter((agent) => getAgentStatus(agent.type, currentSession) === 'working').length,
    [catalog, currentSession]
  );
  const AllAgentsIcon = catalog[0]?.icon;

  return (
    <aside className="w-[260px] shrink-0 border-r border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[var(--app-success)]" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]">Agents</span>
        </div>
        <span className="rounded-[10px] bg-[var(--app-col)] px-2.5 py-1 text-[12px] text-[var(--app-muted)]">{catalog.length}</span>
      </div>

      <div className="border-b border-[var(--app-border)] px-4 py-4">
        <button
          onClick={() => onSelectAgent(catalog[0])}
          className={`flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
            selectedAgentType === 'manager' ? 'border-[var(--app-accent)]/35 bg-[var(--app-accent-soft)]' : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-col)]'
          }`}
        >
          <div className="grid h-12 w-12 place-items-center rounded-[16px] border border-[var(--app-border)] bg-[linear-gradient(140deg,#e3a15c,#8756d5)] text-white shadow-[var(--app-shadow-card)]">
            {AllAgentsIcon ? <AllAgentsIcon size={20} /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--app-text)]">All Agents</p>
            <p className="mt-1 text-[13px] text-[var(--app-sub)]">{catalog.length} total</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-success)]">{activeCount} Active</p>
          </div>
        </button>
      </div>

      <div className="h-[calc(100vh-148px)] overflow-y-auto pb-4">
        {catalog.map((agent) => (
          <AgentRow
            key={agent.type}
            agent={agent}
            selected={selectedAgentType === agent.type}
            status={getAgentStatus(agent.type, currentSession)}
            onClick={() => onSelectAgent(agent)}
          />
        ))}
      </div>
    </aside>
  );
}

function AgentRow({
  agent,
  selected,
  status,
  onClick,
}: {
  agent: AgentCatalogItem;
  selected: boolean;
  status: 'working' | 'waiting' | 'done' | 'offline';
  onClick: () => void;
}) {
  const Icon = agent.icon;
  const statusText = status === 'working' ? 'Working' : status === 'waiting' ? 'Waiting' : status === 'done' ? 'Done' : 'Standby';
  const statusColor = status === 'working' ? 'text-[#38a772]' : status === 'waiting' ? 'text-[#c48a29]' : 'text-[#9b9388]';

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-[var(--app-border)] px-4 py-3.5 text-left transition ${
        selected ? 'bg-[var(--app-col)]' : 'hover:bg-[var(--app-col)]/70'
      }`}
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]">
        <Icon size={20} style={{ color: agent.color }} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--app-text)] leading-tight">{agent.name}</p>
          <span className="shrink-0 rounded-[8px] border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--app-accent)]">
            {agent.badge}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--app-sub)]">{agent.shortRole}</p>
      </div>

      <div className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.1em] ${statusColor}`}>
        <span className={`h-2 w-2 rounded-full ${status === 'working' ? 'bg-[#38a772]' : status === 'waiting' ? 'bg-[#d8a14a]' : 'bg-[#d3ccc2]'}`} />
        {statusText}
      </div>
    </button>
  );
}
