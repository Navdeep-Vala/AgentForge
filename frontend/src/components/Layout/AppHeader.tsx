import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Bot,
  Calendar,
  ChevronDown,
  Menu,
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
  onOpenContext: () => void;
  onOpenStandup: () => void;
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
  onOpenContext,
  onOpenStandup,
  onPause,
  mentionCount,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { currentSession } = useSessionStore();
  const { theme, toggle } = useThemeStore();
  const time = useClock();
  const tasks = currentSession?.tasks ?? [];
  const activeAgents = new Set(
    tasks
      .filter((task) => task.status === "in_progress")
      .map((task) => task.agent_type),
  ).size;

  const menuItems = [
    { label: 'Docs', icon: <BookOpen size={16} />, onClick: onOpenDocs },
    { label: 'Context', icon: <Bot size={16} />, onClick: onOpenContext },
    { label: 'Chat', icon: <MessageCircleMore size={16} />, onClick: onOpenChat },
    { label: 'Broadcast', icon: <Radio size={16} />, onClick: onOpenBroadcast },
    { label: 'Agents', icon: <Users size={16} />, onClick: onManageAgents },
    { label: 'Standup', icon: <Calendar size={16} />, onClick: onOpenStandup },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-app-border bg-app-surface w-full">
      <div className="flex h-[72px] items-center px-6">
        {/* Left: Logo & Project */}
        <div className="flex items-center gap-4 shrink-0 pr-4">
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-app-accent">◇</span>
            <div className="hidden sm:block">
              <p className="text-[14px] font-semibold uppercase tracking-[0.22em] text-app-text leading-tight">
                Mission Control
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-app-muted">
                AgentForge
              </p>
            </div>
          </div>
          <ProjectSelector />
        </div>

        {/* Center: Stats (Growable) */}
        <div className="flex-1 hidden md:flex justify-center items-center gap-4 lg:gap-7 px-4 min-w-0">
          <Stat label="Agents Active" value={String(activeAgents)} />
          <Stat label="Tasks In Queue" value={String(tasks.filter(t => t.status !== 'done').length)} />
        </div>

        {/* Right: Actions & User Info (Fixed width) */}
        <div className="flex shrink-0 items-center gap-1.5 lg:gap-3">
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center gap-2.5 rounded-[14px] border border-app-border bg-app-col px-4 py-2.5 text-[13px] font-semibold text-app-text transition hover:bg-app-surface shadow-sm"
            >
              <Menu size={16} className="text-app-accent" />
              <span>Mission Menu</span>
              <ChevronDown size={14} className={`text-app-muted transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-[20px] border border-app-border bg-app-surface p-2 shadow-2xl z-20 animate-in fade-in zoom-in duration-150">
                  <div className="grid gap-1">
                    {menuItems.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => {
                          item.onClick();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-[13px] font-medium text-app-sub transition hover:bg-app-col hover:text-app-text active:scale-[0.98]"
                      >
                        <span className="text-app-accent">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2">
            <ActionButton
              onClick={onPause}
              icon={currentSession?.status === "running" ? <Pause size={16} /> : <Play size={16} />}
            >
              {currentSession?.status === "running" ? "Pause" : "Active"}
            </ActionButton>
            <IconButton
              onClick={toggle}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </IconButton>
          </div>
 
          <div className="ml-2 flex shrink-0 items-center gap-3 border-l border-app-border pl-3">
            <div className="text-right hidden sm:block">
              <p className="font-mono text-[14px] font-semibold tracking-[0.06em] text-[var(--app-text)]">{time}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
              </p>
            </div>
 
            <button 
              onClick={onOpenStandup}
              className="relative rounded-full bg-app-col p-2.5 text-app-sub hover:bg-app-border transition shrink-0 active:scale-95"
            >
              <Bell size={15} />
              {mentionCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--app-accent)] text-[9px] font-bold text-white shadow-sm animate-pulse">
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
    <div className="text-center shrink-0">
      <p className="text-[24px] lg:text-[28px] font-semibold leading-none tracking-[-0.04em] text-app-text">
        {value}
      </p>
      <p className="mt-1.5 text-[9px] lg:text-[10px] uppercase tracking-[0.18em] text-app-muted truncate">
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
