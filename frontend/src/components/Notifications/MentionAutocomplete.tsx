import { useState, useEffect, type RefObject } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useSessionStore } from '../../store/sessionStore';
import { getAgentCatalog, type AgentCatalogItem } from '../MissionControl/dashboardUtils';

interface MentionAutocompleteProps {
  text: string;
  onSelect: (agentName: string) => void;
  containerRef: RefObject<HTMLElement | null>;
}

export function MentionAutocomplete({ text, onSelect, containerRef }: MentionAutocompleteProps) {
  const [show, setShow] = useState(false);
  const [filteredAgents, setFilteredAgents] = useState<AgentCatalogItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const { agents } = useAgentStore();
  const { currentSession } = useSessionStore();
  
  const catalog = getAgentCatalog(agents, currentSession);
  const allMentions = [...catalog, { name: 'navdeep', type: 'user', icon: 'User' }];

  useEffect(() => {
    const lastAt = text.lastIndexOf('@');
    if (lastAt !== -1) {
      const query = text.slice(lastAt + 1).toLowerCase();
      // Only show if the @ is at the start or preceded by a space
      if (lastAt === 0 || text[lastAt - 1] === ' ' || text[lastAt - 1] === '\n') {
        const matches = allMentions.filter(a => a.name.toLowerCase().includes(query));
        if (matches.length > 0) {
          setFilteredAgents(matches as any);
          setShow(true);
          setSelectedIndex(0);
          return;
        }
      }
    }
    setShow(false);
  }, [text]);

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredAgents.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredAgents.length) % filteredAgents.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(filteredAgents[selectedIndex].name);
        setShow(false);
      } else if (e.key === 'Escape') {
        setShow(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, filteredAgents, selectedIndex, onSelect]);

  if (!show) return null;

  return (
    <div 
      className="absolute bottom-full mb-2 z-[60] w-64 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ left: containerRef.current?.offsetLeft ?? 0 }}
    >
      <div className="p-2 bg-[var(--app-col)] border-b border-[var(--app-border)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-muted)] px-2">Mention Teammate</p>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {filteredAgents.map((agent, i) => (
          <button
            key={agent.name}
            onClick={() => onSelect(agent.name)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-left transition ${
              i === selectedIndex ? 'bg-[var(--app-accent)] text-white' : 'text-[var(--app-text)] hover:bg-[var(--app-col)]'
            }`}
          >
            <div className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${
              i === selectedIndex ? 'bg-white/20' : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
            }`}>
              {agent.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[13px] font-medium">@{agent.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
