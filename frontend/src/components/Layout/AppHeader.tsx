import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  MessageCircleMore,
  Moon,
  Pause,
  Play,
  Radio,
  Sun,
  Users,
} from "lucide-react";
import { useSessionStore } from "../../store/sessionStore";
import { useThemeStore } from "../../store/themeStore";
import { ProjectSelector } from "../ProjectSelector/ProjectSelector";

interface AppHeaderProps {
  onManageAgents: () => void;
  onOpenChat: () => void;
  onOpenBroadcast: () => void;
  onOpenDocs: () => void;
  onPause: () => void;
  mentionCount: number;
}

function useClock() {
  const format = () =>
    new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const [time, setTime] = useState(format);

  useEffect(() => {
    const timer = setInterval(() => setTime(format()), 1000);
    return () => clearInterval(timer);
  }, []);

  return time;
}

export function AppHeader({
  onManageAgents,
  onOpenChat,
  onOpenBroadcast,
  onOpenDocs,
  onPause,
  mentionCount,
}: AppHeaderProps) {
  const { currentSession } = useSessionStore();
  const { theme, toggle } = useThemeStore();
  const time = useClock();
  const tasks = currentSession?.tasks ?? [];
  const activeAgents = new Set(
    tasks
      .filter((task) => task.status === "in_progress")
      .map((task) => task.agent_type),
  ).size;

  return (
    <header className="border-b border-app-border bg-app-surface">
      <div className="flex h-[72px] items-center gap-4 px-6">
        <div className="flex min-w-[220px] items-center gap-3">
          <span className="text-[14px] text-app-accent">◇</span>
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-[0.22em] text-app-text">
              Mission Control
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-app-muted">
              AgentForge
            </p>
          </div>
        </div>

        <ProjectSelector />

        <div className="mx-auto flex items-center gap-7">
          <Stat label="Agents Active" value={String(activeAgents)} />
          <Stat label="Tasks In Queue" value={String(tasks.length)} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ActionButton onClick={onOpenDocs} icon={<BookOpen size={16} />}>
            Docs
          </ActionButton>
          <ActionButton
            onClick={onOpenChat}
            icon={<MessageCircleMore size={16} />}
          >
            Chat
          </ActionButton>
          <ActionButton onClick={onOpenBroadcast} icon={<Radio size={16} />}>
            Broadcast
          </ActionButton>
          <ActionButton onClick={onManageAgents} icon={<Users size={16} />}>
            Agents
          </ActionButton>
          <ActionButton
            onClick={onPause}
            icon={
              currentSession?.status === "running" ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )
            }
          >
            {currentSession?.status === "running" ? "Pause" : "Active"}
          </ActionButton>
          <IconButton
            onClick={toggle}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </IconButton>

          <div className="ml-1 flex items-center gap-3">
            <div className="text-right">
              <p className="font-mono text-[14px] font-semibold tracking-[0.06em] text-[var(--app-text)]">
                {time}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="rounded-[14px] border border-app-success/30 bg-app-success/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-app-success">
              Online
            </div>

            <button className="relative rounded-full bg-app-col p-2.5 text-app-sub">
              <Bell size={15} />
              {mentionCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4.5 w-4.5 place-items-center rounded-full bg-[var(--app-accent)] text-[10px] font-semibold text-white">
                  {mentionCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[112px] text-center">
      <p className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-app-text">
        {value}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-app-muted">
        {label}
      </p>
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-[14px] border border-app-border bg-app-col px-3 py-2 text-[13px] font-medium text-app-sub transition hover:bg-app-surface"
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-10 w-10 place-items-center rounded-[14px] border border-app-border bg-app-col text-app-sub transition hover:bg-app-surface"
    >
      {children}
    </button>
  );
}
