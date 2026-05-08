import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/Layout/AppHeader';
import { AgentSidebar } from './components/AgentPanel/AgentSidebar';
import { AgentProfileModal } from './components/AgentPanel/AgentProfileModal';
import { MissionQueue } from './components/KanbanBoard/MissionQueue';
import { LiveFeed } from './components/LiveFeed/LiveFeed';
import { AgentManager } from './components/AgentManager/AgentManager';
import { ModelSelectorModal } from './components/ModelSelector/ModelSelectorModal';
import { SquadChatModal, BroadcastModal, DocsModal } from './components/Squad/SquadChatModal';
import { TaskDetailModal } from './components/TaskDetail/TaskDetailModal';
import { MentionToasts, type MentionToast } from './components/Notifications/MentionToasts';
import { useSession } from './hooks/useSession';
import { useSSE } from './hooks/useSSE';
import { useSessionStore } from './store/sessionStore';
import { useThemeStore } from './store/themeStore';
import type { Task } from './types';
import { getAgentCatalog, getUserMentions, USER_HANDLE, type AgentCatalogItem } from './components/MissionControl/dashboardUtils';
import { useAgentStore } from './store/agentStore';

export default function App() {
  const [agentManagerOpen, setAgentManagerOpen] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentCatalogItem | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [toasts, setToasts] = useState<MentionToast[]>([]);

  const { currentSession, chatMessages, comments } = useSessionStore();
  const { startSession, stopSession } = useSession();
  const { theme } = useThemeStore();
  const { agents } = useAgentStore();
  const mentionSourceRef = useRef<Set<string>>(new Set());

  useSSE(currentSession?.id ?? null);

  useEffect(() => {
    const root = document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
  }, [theme]);

  const agentCatalog = useMemo(() => getAgentCatalog(agents, currentSession), [agents, currentSession]);
  const userMentions = useMemo(() => getUserMentions(chatMessages, comments), [chatMessages, comments]);

  useEffect(() => {
    for (const mention of userMentions) {
      if (mentionSourceRef.current.has(mention.id)) continue;
      mentionSourceRef.current.add(mention.id);
      if (mention.agent_name.toLowerCase() === USER_HANDLE) continue;

      const toast = {
        id: mention.id,
        title: `${mention.agent_name} mentioned @${USER_HANDLE}`,
        body: mention.content.slice(0, 140),
      };

      setToasts((current) => [toast, ...current].slice(0, 4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== mention.id));
      }, 8000);
    }
  }, [userMentions]);

  const handleLaunchMission = async (goal: string) => {
    await startSession(goal, currentSession?.project_id ?? undefined, currentSession?.workspace_dir ?? undefined);
  };

  const handlePause = () => {
    if (currentSession?.id && (currentSession.status === 'running' || currentSession.status === 'pending')) {
      stopSession(currentSession.id);
      return;
    }

    const manager = agentCatalog.find((agent) => agent.type === 'manager') ?? null;
    setSelectedAgent(manager);
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <AppHeader
        onManageAgents={() => setAgentManagerOpen(true)}
        onOpenChat={() => setChatOpen(true)}
        onOpenBroadcast={() => setBroadcastOpen(true)}
        onOpenDocs={() => setDocsOpen(true)}
        onPause={handlePause}
        mentionCount={userMentions.length}
      />

      <div className="flex h-[calc(100vh-72px)] overflow-hidden">
        <AgentSidebar selectedAgentType={selectedAgent?.type ?? null} onSelectAgent={setSelectedAgent} />
        <MissionQueue onOpenTask={setSelectedTask} />
        <LiveFeed />
      </div>

      {selectedTask && <TaskDetailModal task={selectedTask} comments={comments} onClose={() => setSelectedTask(null)} />}

      {selectedAgent && (
        <AgentProfileModal
          agent={selectedAgent}
          sessionId={currentSession?.id ?? null}
          tasks={currentSession?.tasks ?? []}
          comments={comments}
          chatMessages={chatMessages}
          onClose={() => setSelectedAgent(null)}
          onOpenTask={setSelectedTask}
          onLaunchMission={handleLaunchMission}
        />
      )}

      {chatOpen && <SquadChatModal sessionId={currentSession?.id ?? null} messages={chatMessages} onClose={() => setChatOpen(false)} />}
      {broadcastOpen && <BroadcastModal sessionId={currentSession?.id ?? null} onClose={() => setBroadcastOpen(false)} />}
      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}
      {agentManagerOpen && <AgentManager onClose={() => setAgentManagerOpen(false)} />}
      {modelSelectorOpen && <ModelSelectorModal onClose={() => setModelSelectorOpen(false)} />}

      <MentionToasts toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}
