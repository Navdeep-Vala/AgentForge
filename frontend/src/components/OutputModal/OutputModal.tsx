import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, Copy, Check } from 'lucide-react';
import { Task } from '../../types';

const AGENT_COLORS: Record<string, string> = {
  researcher: '#3B82F6',
  coder:      '#10B981',
  tester:     '#F59E0B',
  rnd:        '#8B5CF6',
};

interface OutputModalProps {
  task: Task;
  onClose: () => void;
}

export function OutputModal({ task, onClose }: OutputModalProps) {
  const [copied, setCopied] = React.useState(false);
  const color = AGENT_COLORS[task.agent_type] ?? '#6B7280';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCopy = async () => {
    if (!task.output) return;
    await navigator.clipboard.writeText(task.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-app-surface border border-app-border rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-card-md">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
              style={{ backgroundColor: color }}
            >
              {task.agent_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] text-app-muted font-medium">{task.agent_name}</p>
              <h2 className="text-sm font-semibold text-app-text leading-snug">{task.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded bg-app-col text-app-sub hover:text-app-text border border-app-border transition-colors"
            >
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-app-col text-app-muted hover:text-app-text transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {task.output ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node: _node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className ?? '');
                    return !match ? (
                      <code className="bg-app-col rounded px-1 py-0.5 text-xs font-mono text-indigo-400" {...props}>
                        {children}
                      </code>
                    ) : (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ borderRadius: '8px', margin: '0.5rem 0', fontSize: '0.8rem' }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    );
                  },
                }}
              >
                {task.output}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-app-muted text-sm text-center py-8">No output available</p>
          )}
        </div>

        {task.tokens_used > 0 && (
          <div className="px-4 py-2.5 border-t border-app-border text-[10px] text-app-muted">
            {task.tokens_used.toLocaleString()} tokens · $0.00 (free model)
          </div>
        )}
      </div>
    </div>
  );
}
