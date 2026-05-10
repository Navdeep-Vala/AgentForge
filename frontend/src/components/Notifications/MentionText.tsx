import React from 'react';

interface MentionTextProps {
  content: string;
  onMentionClick?: (mention: string) => void;
  className?: string;
}

export function MentionText({ content, onMentionClick, className = '' }: MentionTextProps) {
  // Regex to find mentions starting with @ followed by alphanumeric characters, hyphens or underscores
  const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
  
  const parts = content.split(mentionRegex);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.match(mentionRegex)) {
          const mentionName = part.substring(1); // Remove @
          return (
            <span
              key={index}
              onClick={(e) => {
                if (onMentionClick) {
                  e.stopPropagation();
                  onMentionClick(mentionName);
                }
              }}
              className={`inline-block px-1 rounded-[4px] font-semibold text-[var(--app-accent)] bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/20 cursor-pointer hover:bg-[var(--app-accent)] hover:text-white transition-all duration-200`}
            >
              {part}
            </span>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}
