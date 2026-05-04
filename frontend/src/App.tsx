import { useState, useEffect } from 'react';
import { AppHeader }           from './components/Layout/AppHeader';
import { AgentSidebar }        from './components/AgentPanel/AgentSidebar';
import { MissionQueue }        from './components/KanbanBoard/MissionQueue';
import { LiveFeed }            from './components/LiveFeed/LiveFeed';
import { AgentManager }        from './components/AgentManager/AgentManager';
import { ModelSelectorModal }  from './components/ModelSelector/ModelSelectorModal';
import { useSession }          from './hooks/useSession';
import { useSSE }              from './hooks/useSSE';
import { useSessionStore }     from './store/sessionStore';
import { useThemeStore }       from './store/themeStore';

export default function App() {
  const [agentManagerOpen, setAgentManagerOpen]   = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const { currentSession }                        = useSessionStore();
  const { startSession, stopSession, loadSession } = useSession();
  const { theme }                                 = useThemeStore();

  useSSE(currentSession?.id ?? null);

  useEffect(() => {
    const root = document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
  }, [theme]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-app-bg text-app-text">
      <AppHeader
        onManageAgents={() => setAgentManagerOpen(true)}
        onSelectModels={() => setModelSelectorOpen(true)}
        onLoadSession={loadSession}
        onStart={startSession}
        onCancel={() => currentSession?.id && stopSession(currentSession.id)}
      />

      <div className="flex flex-1 overflow-hidden">
        <AgentSidebar />
        <MissionQueue />
        <LiveFeed />
      </div>

      {agentManagerOpen  && <AgentManager onClose={() => setAgentManagerOpen(false)} />}
      {modelSelectorOpen && <ModelSelectorModal onClose={() => setModelSelectorOpen(false)} />}
    </div>
  );
}
