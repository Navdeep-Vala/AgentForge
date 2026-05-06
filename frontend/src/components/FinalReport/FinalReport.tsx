import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Download, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';

export function FinalReport() {
  const { currentSession } = useSessionStore();
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const report = currentSession?.final_report;
  if (!report || currentSession?.status !== 'completed') return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentforge-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="shrink-0 mx-4 mb-3 bg-app-surface border border-amber-500/25 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-500/6 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <Trophy size={12} className="text-amber-500" />
          <span className="text-[11px] font-semibold text-app-text">Final Report</span>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
            Complete
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-app-col text-app-sub hover:text-app-text border border-app-border transition-colors"
          >
            {copied ? <Check size={9} className="text-emerald-500" /> : <Copy size={9} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-app-col text-app-sub hover:text-app-text border border-app-border transition-colors"
          >
            <Download size={9} />
            .md
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded hover:bg-app-col text-app-muted transition-colors"
          >
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 overflow-y-auto max-h-64">
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
                      customStyle={{ borderRadius: '6px', margin: '0.5rem 0', fontSize: '0.75rem' }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                },
              }}
            >
              {report}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
