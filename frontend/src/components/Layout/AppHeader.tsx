import { useState, useEffect, type ReactNode } from 'react';
import { Sun, Moon, Users, History, ChevronDown, X, Zap, CheckSquare, Cpu } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { useThemeStore }   from '../../store/themeStore';
import { listSessions }    from '../../api/client';
import { SessionSummary }  from '../../types';

interface AppHeaderProps {
  onManageAgents:  () => void;
  onSelectModels:  () => void;
  onLoadSession:   (id: string) => Promise<void>;
  onStart:         (goal: string) => Promise<string | null>;
  onCancel:        () => void;
}

function useClock() {
  const fmt = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const [t, setT] = useState(fmt);
  useEffect(() => { const id = setInterval(() => setT(fmt()), 1000); return () => clearInterval(id); }, []);
  return t;
}

export function AppHeader({ onManageAgents, onSelectModels, onLoadSession, onStart, onCancel }: AppHeaderProps) {
  const { currentSession } = useSessionStore();
  const { theme, toggle }  = useThemeStore();
  const time               = useClock();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions]       = useState<SessionSummary[]>([]);
  const [goal, setGoal]               = useState('');
  const [goalError, setGoalError]     = useState('');

  const tasks      = currentSession?.tasks ?? [];
  const active     = new Set(tasks.filter(t => t.status === 'in_progress').map(t => t.agent_type)).size;
  const done       = tasks.filter(t => t.status === 'done').length;
  const isRunning  = currentSession?.status === 'running' || currentSession?.status === 'pending';

  useEffect(() => {
    if (historyOpen) listSessions().then(setSessions).catch(() => {});
  }, [historyOpen]);

  const handleStart = async () => {
    const g = goal.trim();
    if (!g || isRunning) return;
    const err = validateGoal(g);
    if (err) { setGoalError(err); return; }
    setGoalError('');
    setGoal('');
    await onStart(g);
  };

  return (
    <header className="h-11 flex-shrink-0 flex items-center border-b bg-app-surface border-app-border px-4 gap-4 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="grid grid-cols-2 gap-[3px] w-[14px]">
          {[0,1,2,3].map(i => <div key={i} className="w-[5px] h-[5px] rounded-[1px] bg-app-text opacity-90" />)}
        </div>
        <span className="font-semibold text-sm tracking-tight text-app-text">MISSION CONTROL</span>
        {currentSession && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-app-col text-app-sub border border-app-border">
            {currentSession.id.slice(0, 6).toUpperCase()}
          </span>
        )}
      </div>

      {/* Goal input */}
      <div className="flex-1 flex flex-col gap-0.5 max-w-xl mx-auto">
      <div className="flex items-center gap-2">
        <input
          value={goal}
          onChange={e => { setGoal(e.target.value); if (goalError) setGoalError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder={isRunning ? currentSession?.goal ?? 'Running…' : 'Describe your goal…'}
          disabled={isRunning}
          className={`flex-1 h-7 px-3 rounded text-[12px] bg-app-col border text-app-text placeholder:text-app-muted focus:outline-none transition-colors disabled:opacity-60 ${goalError ? 'border-red-500/60 focus:border-red-500' : 'border-app-border focus:border-app-sub'}`}
        />
        {isRunning ? (
          <button onClick={onCancel} className="px-2.5 h-7 rounded text-[11px] font-medium bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors flex-shrink-0">
            Cancel
          </button>
        ) : (
          <button onClick={handleStart} disabled={!goal.trim()} className="px-3 h-7 rounded text-[11px] font-semibold bg-app-text text-app-surface hover:opacity-80 disabled:opacity-30 transition-opacity flex-shrink-0">
            Run →
          </button>
        )}
      </div>
      {goalError && <p className="text-[10px] text-red-400 pl-1">{goalError}</p>}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-5 flex-shrink-0">
        <Stat label="AGENTS ACTIVE" value={active} icon={<Zap size={10} />} accent="text-amber-500" />
        <Stat label="TASKS DONE"    value={done}   icon={<CheckSquare size={10} />} accent="text-emerald-500" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* History */}
        <div className="relative">
          <Btn onClick={() => setHistoryOpen(o => !o)}>
            <History size={13} />
            <ChevronDown size={10} className={historyOpen ? 'rotate-180' : ''} style={{ transition: 'transform 0.15s' }} />
          </Btn>
          {historyOpen && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-app-surface border border-app-border rounded-lg shadow-card-md z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-app-border">
                <span className="text-[10px] font-semibold text-app-muted uppercase tracking-widest">History</span>
                <button onClick={() => setHistoryOpen(false)}><X size={12} className="text-app-muted" /></button>
              </div>
              {sessions.length === 0
                ? <p className="text-[11px] text-app-muted text-center py-5">No sessions yet</p>
                : <ul className="max-h-60 overflow-y-auto">
                    {sessions.map(s => (
                      <li key={s.id}>
                        <button
                          onClick={() => { setHistoryOpen(false); onLoadSession(s.id); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-app-col border-b border-app-border/50 last:border-0 transition-colors"
                        >
                          <p className="text-[11px] text-app-text truncate">{s.goal}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                              s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                              s.status === 'running'   ? 'bg-blue-500/10 text-blue-400' :
                              'bg-app-col text-app-muted'
                            }`}>{s.status}</span>
                            <span className="text-[9px] text-app-muted">{new Date(s.created_at).toLocaleDateString()} · {s.taskCount} tasks</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
              }
            </div>
          )}
        </div>

        <Btn onClick={onSelectModels} title="Configure agent models"><Cpu size={13} /></Btn>
        <Btn onClick={onManageAgents} title="Manage agents"><Users size={13} /></Btn>

        <div className="w-px h-4 bg-app-border mx-0.5" />

        <Btn onClick={toggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </Btn>

        <div className="w-px h-4 bg-app-border mx-0.5" />

        <span className="font-mono text-[11px] text-app-sub tabular-nums">{time}</span>

        <div className="flex items-center gap-1.5 ml-1 px-2 py-1 rounded text-[9px] font-semibold uppercase tracking-widest border border-emerald-500/30 text-emerald-500 bg-emerald-500/8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </div>
      </div>
    </header>
  );
}

const GREETING_PATTERN = /^(hi+|hey+|hello+|howdy|yo+|sup|greetings|hola|hii+|hiii+|hai+)[\s!.,]*(?:all|everyone|there|guys|team)?[\s!.,]*$/i;

function validateGoal(goal: string): string {
  if (goal.length < 10) return 'Please describe a real goal (at least 10 characters).';
  if (GREETING_PATTERN.test(goal)) return 'That looks like a greeting, not a goal. Describe what you want to build or research.';
  const words = goal.trim().split(/\s+/);
  if (words.length < 3) return 'Please be more specific — describe what you want to accomplish.';
  return '';
}

function Stat({ label, value, icon, accent }: { label: string; value: number; icon: ReactNode; accent: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xl font-semibold tabular-nums text-app-text">{value}</span>
      <div>
        <div className={`flex items-center gap-0.5 ${accent}`}>{icon}</div>
        <p className="text-[8px] font-medium tracking-widest text-app-muted uppercase leading-none mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Btn({ onClick, children, title }: { onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 px-2 h-7 rounded text-app-sub hover:text-app-text hover:bg-app-col transition-colors text-[11px]"
    >
      {children}
    </button>
  );
}
