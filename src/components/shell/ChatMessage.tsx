import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message } from '@/types/chat';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const navigate = useNavigate();
  const isUser = message.role === 'user';

  const handleLinkClick = useCallback(
    (href: string) => {
      if (href.startsWith('/')) {
        navigate(href);
      } else {
        window.open(href, '_blank', 'noopener');
      }
    },
    [navigate],
  );

  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <div
          style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            padding: '4px 0',
          }}
        >
          <div
            style={{
              maxWidth: '85%',
              padding: '8px 12px',
              background: isUser ? 'var(--amber-dim)' : 'var(--card)',
              borderRadius: isUser
                ? '12px 12px 4px 12px'
                : '12px 12px 12px 4px',
              border: isUser ? 'none' : '1px solid var(--border)',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {isUser ? (
              <p style={{ margin: 0 }}>{message.content}</p>
            ) : (
              <div className="chat-markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    a: ({ href, children }) => {
                      if (!href) return <>{children}</>;
                      const isInternal = href.startsWith('/');
                      if (isInternal) {
                        return (
                          <button
                            onClick={() => handleLinkClick(href)}
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              padding: '2px 8px',
                              cursor: 'pointer',
                              color: 'var(--amber)',
                              fontSize: '0.8125rem',
                              fontFamily: 'var(--font-sans)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'background var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
                          >
                            {children}
                          </button>
                        );
                      }
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--amber)' }}
                        >
                          {children}
                        </a>
                      );
                    },
                    pre: ({ children }) => (
                      <div style={{ position: 'relative', margin: '8px 0' }}>
                        <pre
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '12px 16px',
                            overflow: 'auto',
                            fontSize: '0.8125rem',
                            fontFamily: 'var(--font-mono)',
                            margin: 0,
                          }}
                        >
                          {children}
                        </pre>
                        <CopyButton getContent={() => {
                          const el = document.createElement('div');
                          el.innerHTML = typeof children === 'string' ? children : '';
                          return el.textContent ?? '';
                        }} />
                      </div>
                    ),
                    code: ({ className, children, ...props }) => {
                      const isBlock = className?.startsWith('language-');
                      if (isBlock) {
                        return <code className={className} {...props}>{children}</code>;
                      }
                      return (
                        <code
                          style={{
                            background: 'var(--surface)',
                            padding: '1px 4px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8125rem',
                            fontFamily: 'var(--font-mono)',
                          }}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    p: ({ children }) => <p style={{ margin: '4px 0' }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ol>,
                    li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
                    h1: ({ children }) => <h3 style={{ margin: '8px 0 4px', fontSize: '1rem', fontWeight: 600 }}>{children}</h3>,
                    h2: ({ children }) => <h3 style={{ margin: '8px 0 4px', fontSize: '1rem', fontWeight: 600 }}>{children}</h3>,
                    h3: ({ children }) => <h3 style={{ margin: '6px 0 4px', fontSize: '0.9375rem', fontWeight: 600 }}>{children}</h3>,
                    blockquote: ({ children }) => (
                      <blockquote
                        style={{
                          borderLeft: '2px solid var(--amber)',
                          paddingLeft: 12,
                          margin: '4px 0',
                          color: 'var(--text-dim)',
                        }}
                      >
                        {children}
                      </blockquote>
                    ),
                    table: ({ children }) => (
                      <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600 }}>
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                        {children}
                      </td>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 14,
                  background: 'var(--amber)',
                  marginLeft: 2,
                  animation: 'blink 1s step-end infinite',
                  verticalAlign: 'text-bottom',
                }}
              />
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side={isUser ? 'left' : 'right'}>
        {timeStr}{message.model ? ` · ${message.model}` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

function CopyButton({ getContent }: { getContent: () => string }) {
  const handleCopy = useCallback(async () => {
    try {
      // Try getting text from the sibling pre element
      const text = getContent();
      await navigator.clipboard.writeText(text);
    } catch {
      // Silently fail
    }
  }, [getContent]);

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: 'var(--surface-hover)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '2px 6px',
        cursor: 'pointer',
        color: 'var(--text-dim)',
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-sans)',
        transition: 'opacity var(--transition-fast)',
        opacity: 0.6,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
    >
      Copy
    </button>
  );
}
