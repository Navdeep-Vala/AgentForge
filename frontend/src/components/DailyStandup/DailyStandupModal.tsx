import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Calendar, RefreshCw, History, CheckCircle2, ChevronRight } from 'lucide-react';

interface Standup {
  id: string;
  date_str: string;
  content: string;
  created_at: number;
}

interface DailyStandupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyStandupModal: React.FC<DailyStandupModalProps> = ({ isOpen, onClose }) => {
  const [latestStandup, setLatestStandup] = useState<Standup | null>(null);
  const [history, setHistory] = useState<Standup[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'latest' | 'history'>('latest');

  useEffect(() => {
    if (isOpen) {
      fetchLatest();
      fetchHistory();
    }
  }, [isOpen]);

  const fetchLatest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/standups/latest');
      const data = await response.json();
      setLatestStandup(data);
    } catch (err) {
      console.error('Failed to fetch latest standup:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/standups/history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch standup history:', err);
    }
  };

  const triggerGeneration = async () => {
    setLoading(true);
    try {
      await fetch('/api/standups/trigger', { method: 'POST' });
      await fetchLatest();
    } catch (err) {
      console.error('Failed to trigger standup:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-3xl max-h-[85vh] bg-[#121212] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg text-white">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                Daily Standup
              </h2>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Squad Intel • Accountability</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
              <button 
                onClick={() => setView('latest')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  view === 'latest' ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <CheckCircle2 size={14} />
                Latest
              </button>
              <button 
                onClick={() => setView('history')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  view === 'history' ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <History size={14} />
                History
              </button>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white transition-colors ml-2"
            >
              <X size={24} />
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium animate-pulse">Aggregating squad metrics...</p>
            </div>
          ) : view === 'latest' ? (
            latestStandup ? (
              <div className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-li:my-1">
                <ReactMarkdown>{latestStandup.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-white/5 rounded-full mb-4 text-zinc-600">
                  <Calendar size={48} strokeWidth={1} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No standup generated</h3>
                <p className="text-sm text-zinc-500 max-w-xs mb-6">
                  Our Lead Manager compiles this report every day at 11:30 PM IST. You can manually trigger one now.
                </p>
                <button 
                  onClick={triggerGeneration}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5"
                >
                  <RefreshCw size={18} />
                  Generate Initial Standup
                </button>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className="group p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] hover:border-white/10 transition-all cursor-pointer"
                  onClick={() => {
                    setLatestStandup(item);
                    setView('latest');
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-bold">{item.date_str}</h4>
                    <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                      {new Date(item.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-500 line-clamp-2 prose prose-invert prose-xs">
                    <ReactMarkdown>{item.content.split('\n').slice(0, 3).join('\n')}</ReactMarkdown>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-white/40 group-hover:text-white transition-colors">
                    View Full Report <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Next scheduled run: Today at 23:30 IST
          </div>
          {latestStandup && (
            <button 
              onClick={triggerGeneration}
              className="flex items-center gap-2 px-3 py-1.5 text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Recalculate
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
