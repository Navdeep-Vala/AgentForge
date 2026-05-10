import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "./components/Layout/AppHeader";
import { AgentSidebar } from "./components/AgentPanel/AgentSidebar";
import { AgentProfileModal } from "./components/AgentPanel/AgentProfileModal";
import { MissionQueue } from "./components/KanbanBoard/MissionQueue";
import { LiveFeed } from "./components/LiveFeed/LiveFeed";
import { AgentManager } from "./components/AgentManager/AgentManager";
import { ModelSelectorModal } from "./components/ModelSelector/ModelSelectorModal";
import {
  SquadChatModal,
  BroadcastModal,
  DocsModal,
} from "./components/Squad/SquadChatModal";
import { TaskDetailModal } from "./components/TaskDetail/TaskDetailModal";
import { ProjectContextModal } from "./components/ProjectSelector/ProjectContextModal";
import { DailyStandupModal } from "./components/DailyStandup/DailyStandupModal";
import {
  MentionToasts,
  type MentionToast,
  type ClarificationToast,
  type ApprovalToast,
} from "./components/Notifications/MentionToasts";
import { useSession } from "./hooks/useSession";
import { useSSE } from "./hooks/useSSE";
import { useSessionStore } from "./store/sessionStore";
import { useThemeStore } from "./store/themeStore";
import type { Session, Task, SubAgent, ClarificationRequest } from "./types";
import {
  getAgentCatalog,
  getUserMentions,
  USER_HANDLE,
  type AgentCatalogItem,
} from "./components/MissionControl/dashboardUtils";
import { useAgentStore } from "./store/agentStore";

export default function App() {
  const [agentManagerOpen, setAgentManagerOpen] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [projectContextOpen, setProjectContextOpen] = useState(false);
  const [dailyStandupOpen, setDailyStandupOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentCatalogItem | null>(
    null,
  );
  const [selectedTaskSteps, setSelectedTaskSteps] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [toasts, setToasts] = useState<MentionToast[]>([]);
  const [clarificationToasts, setClarificationToasts] = useState<ClarificationToast[]>([]);
  const [approvalToasts, setApprovalToasts] = useState<ApprovalToast[]>([]);

  const { currentSession, chatMessages, comments, clarificationRequests } = useSessionStore();
  const { startSession, stopSession } = useSession();
  const { theme } = useThemeStore();
  const { agents } = useAgentStore();
  const mentionSourceRef = useRef<Set<string>>(new Set());

  useSSE(currentSession?.id ?? null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/logo.png" });
    }
  };

  useEffect(() => {
    if (selectedTaskId) {
      import("./api/client").then(({ getTask }) => {
        getTask(selectedTaskId).then((data) => {
          setSelectedTaskSteps(data.agentSteps);
        });
      });
    } else {
      setSelectedTaskSteps([]);
    }
  }, [selectedTaskId]);

  const agentCatalog = useMemo(
    () => getAgentCatalog(agents, currentSession),
    [agents, currentSession],
  );

  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !currentSession?.tasks) return null;
    return (currentSession.tasks as Task[]).find(t => t.id === selectedTaskId) || null;
  }, [selectedTaskId, currentSession?.tasks]);
  const userMentions = useMemo(
    () => getUserMentions(chatMessages, comments),
    [chatMessages, comments],
  );

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
      showNotification(toast.title, toast.body);
      
      window.setTimeout(() => {
        setToasts((current) =>
          current.filter((item) => item.id !== mention.id),
        );
      }, 8000);
    }
  }, [userMentions]);

  // Handle clarification requests as toasts
  useEffect(() => {
    if (!clarificationRequests) return;
    const pendingRequests = clarificationRequests.filter((c) => c.status === 'pending');
    for (const req of pendingRequests) {
      if (mentionSourceRef.current.has(`clar-${req.id}`)) continue;
      mentionSourceRef.current.add(`clar-${req.id}`);

      const toast = {
        id: `clar-${req.id}`,
        title: `${req.agent_name ? req.agent_name : 'Agent'} needs clarification`,
        body: req.question.slice(0, 140),
      };

      setClarificationToasts((current) => [toast, ...current].slice(0, 4));
      showNotification(toast.title, toast.body);

      window.setTimeout(() => {
        setClarificationToasts((current) =>
          current.filter((item) => item.id !== `clar-${req.id}`),
        );
      }, 15000);
    }
  }, [clarificationRequests]);

  // Handle approval responses as toasts
  useEffect(() => {
    if (!currentSession?.tasks) return;
    const tasks = currentSession.tasks as (Task & { status: string })[];
    for (const task of tasks) {
      if (task.status === 'done' && !mentionSourceRef.current.has(`approval-${task.id}`)) {
        // Check if this was recently approved (transitioned from needs_approval to done)
        if (['coder', 'tester'].includes(task.agent_type)) {
          mentionSourceRef.current.add(`approval-${task.id}`);
          const toast: ApprovalToast = {
            id: `approval-${task.id}`,
            title: `${task.agent_name} task approved`,
            body: `"${task.title}" has been completed and approved.`,
          };
          setApprovalToasts((current) => [toast, ...current].slice(0, 4));
          window.setTimeout(() => {
            setApprovalToasts((current) =>
              current.filter((item) => item.id !== `approval-${task.id}`),
            );
          }, 10000);
        }
      }
    }
  }, [currentSession?.tasks]);

  const selectedAgentSubAgentIds = useMemo(() => {
    if (!currentSession || !selectedAgent) return [];
    const session = currentSession as Session & { subAgents?: SubAgent[] };
    if (!session.subAgents) return [];
    return session.subAgents
      .filter((sa) =>
        (currentSession.tasks ?? []).some(
          (t) => t.agent_type === selectedAgent.type && t.id === sa.task_id
        )
      )
      .map((sa) => sa.id);
  }, [currentSession, selectedAgent]);

  const handleLaunchMission = async (goal: string) => {
    await startSession(
      goal,
      currentSession?.project_id ?? undefined,
      currentSession?.workspace_dir ?? undefined,
    );
  };

  const handlePause = () => {
    if (
      currentSession?.id &&
      (currentSession.status === "running" ||
        currentSession.status === "pending")
    ) {
      stopSession(currentSession.id);
      return;
    }

    const manager =
      agentCatalog.find((agent) => agent.type === "manager") ?? null;
    setSelectedAgent(manager);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-app-bg text-app-text">
      <AppHeader
        onManageAgents={() => setAgentManagerOpen(true)}
        onOpenChat={() => setChatOpen(true)}
        onOpenBroadcast={() => setBroadcastOpen(true)}
        onOpenDocs={() => setDocsOpen(true)}
        onOpenContext={() => setProjectContextOpen(true)}
        onOpenStandup={() => setDailyStandupOpen(true)}
        onPause={handlePause}
        mentionCount={userMentions.length + clarificationRequests.filter((c: ClarificationRequest) => c.status === 'pending').length + approvalToasts.length}
      />

      <div className="flex h-[calc(100vh-72px)] overflow-hidden">
        <AgentSidebar
          selectedAgentType={selectedAgent?.type ?? null}
          onSelectAgent={setSelectedAgent}
        />
        <MissionQueue onOpenTask={(task) => setSelectedTaskId(task.id)} />
        <LiveFeed onOpenTask={(taskId) => setSelectedTaskId(taskId)} onOpenDocs={() => setDocsOpen(true)} />
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          comments={comments}
          subAgents={(currentSession as any).subAgents ?? []}
          clarificationRequests={clarificationRequests}
          childTasks={[]}
          agentSteps={selectedTaskSteps}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {selectedAgent && (
        <AgentProfileModal
          agent={selectedAgent}
          sessionId={currentSession?.id ?? null}
          tasks={currentSession?.tasks ?? []}
          comments={comments}
          chatMessages={chatMessages}
          subAgentIds={selectedAgentSubAgentIds}
          onClose={() => setSelectedAgent(null)}
          onOpenTask={(task) => setSelectedTaskId(task.id)}
          onLaunchMission={handleLaunchMission}
        />
      )}

      {chatOpen && (
        <SquadChatModal
          sessionId={currentSession?.id ?? null}
          messages={chatMessages}
          onClose={() => setChatOpen(false)}
        />
      )}
      {broadcastOpen && (
        <BroadcastModal
          sessionId={currentSession?.id ?? null}
          onClose={() => setBroadcastOpen(false)}
        />
      )}
      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}
      {projectContextOpen && <ProjectContextModal onClose={() => setProjectContextOpen(false)} />}
      {agentManagerOpen && (
        <AgentManager onClose={() => setAgentManagerOpen(false)} />
      )}
      {modelSelectorOpen && (
        <ModelSelectorModal onClose={() => setModelSelectorOpen(false)} />
      )}
      <DailyStandupModal 
        isOpen={dailyStandupOpen} 
        onClose={() => setDailyStandupOpen(false)} 
      />

      <MentionToasts
        toasts={toasts}
        clarificationToasts={clarificationToasts}
        approvalToasts={approvalToasts}
        onDismiss={(id) => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
          setClarificationToasts((current) => current.filter((toast) => toast.id !== id));
          setApprovalToasts((current) => current.filter((toast) => toast.id !== id));
        }}
      />
    </div>
  );
}
