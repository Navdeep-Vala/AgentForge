import React, { useState, useEffect, useRef } from 'react';
import { Bot, History, Users, ChevronDown, X } from 'lucide-react';
import { useSession } from '../../hooks/useSession';
import { listSessions } from '../../api/client';
import { SessionSummary } from '../../types';

interface AppLayoutProps {
  children: React.ReactNode;
  onManageAgents: () => void;
}

export function AppLayout({ children, onManageAgents }: AppLayoutProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const { loadSession } = useSession();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyOpen) {
      listSessions().then(setSessions).catch(() => undefined);
    }
  }, [historyOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLoadSession = async (id: string) => {
    setHistoryOpen(false);
    await loadSession(id);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Bot className="text-indigo-400" size={22} />
          <span className="font-bold text-lg tracking-tight">AgentForge</span>
        </div>

        <nav className="flex items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <History size={15} />
              History
              <ChevronDown size={13} className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>

            {historyOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Past Sessions</span>
                  <button onClick={() => setHistoryOpen(false)}><X size={14} className="text-gray-500" /></button>
                </div>
                {sessions.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">No past sessions</p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {sessions.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => handleLoadSession(s.id)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                        >
                          <p className="text-sm text-gray-100 truncate">{s.goal}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StatusBadge status={s.status} />
                            <span className="text-xs text-gray-500">
                              {new Date(s.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-gray-600">·</span>
                            <span className="text-xs text-gray-500">{s.taskCount} tasks</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onManageAgents}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <Users size={15} />
            Manage Agents
          </button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-900 text-green-300',
    running: 'bg-blue-900 text-blue-300',
    cancelled: 'bg-red-900 text-red-300',
    pending: 'bg-yellow-900 text-yellow-300',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  );
}
