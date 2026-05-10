import { AgentBadge } from './AgentBadge';
import { useSessionStore } from '../../store/sessionStore';
import { useAgentStore } from '../../store/agentStore';

const BUILT_IN_AGENTS = [
  { type: 'manager', name: 'Manager', color: '#d8892d', icon: 'Zap' },
  { type: 'researcher', name: 'Researcher', color: '#3B82F6', icon: 'Search' },
  { type: 'coder', name: 'Coder', color: '#10B981', icon: 'Code2' },
  { type: 'tester', name: 'Tester', color: '#F59E0B', icon: 'TestTube' },
  { type: 'rnd', name: 'R&D Analyst', color: '#8B5CF6', icon: 'BarChart2' },
] as const;

export function AgentPanel() {
  const { currentSession } = useSessionStore();
  const { agents: backendAgents } = useAgentStore();
  const tasks = currentSession?.tasks ?? [];

  const getAgentStatus = (type: string): { status: 'idle' | 'working' | 'done'; task?: string } => {
    const agentTasks = tasks.filter((t) => t.agent_type === type);
    if (agentTasks.length === 0) return { status: 'idle' };
    const inProgress = agentTasks.find((t) => t.status === 'in_progress');
    if (inProgress) return { status: 'working', task: inProgress.title };
    const allDone = agentTasks.every((t) => t.status === 'done' || t.status === 'failed' || t.status === 'cancelled');
    if (allDone) return { status: 'done' };
    return { status: 'idle' };
  };

  const allAgents = backendAgents.length > 0 
    ? backendAgents.filter(a => a.is_active !== false)
    : BUILT_IN_AGENTS;

  const relevantAgents = currentSession
    ? allAgents.filter((a) => tasks.some((t) => t.agent_type === a.type) || true)
    : allAgents;

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Team</h2>
      <div className="flex flex-wrap gap-3">
        {relevantAgents.map((agent) => {
          const { status, task } = getAgentStatus(agent.type);
          return (
            <AgentBadge
              key={agent.type}
              name={agent.name}
              color={agent.color}
              icon={agent.icon}
              status={status}
              currentTask={task}
            />
          );
        })}
      </div>
    </div>
  );
}
