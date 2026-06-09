/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Layout, FileText, Image as ImageIcon, File, Loader2, AlertTriangle, RefreshCw, Wand2, Settings } from 'lucide-react';
import type { Message, MessageApproval, ChatAttachment, ToolCallRecord } from '@/types/chat';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useSecurityStore } from '@/stores/security.store';
import { useChatStore } from '@/stores/chat.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { startGateway } from '@/services/gateway.service';
import { ToolRenderer } from '@/components/chat/tool-renderers';
import { ReasoningChip } from '@/components/chat/ReasoningChip';
import { shouldRenderTool } from '@/config/tool-rendering';
import { useToolVisibility } from '@/hooks/use-tool-visibility';

/** Convert a live streaming ToolExecution into the ToolCallRecord shape the
 *  per-tool renderers expect, so a streaming pill looks IDENTICAL to its
 *  finalized form (same per-tool component, same chrome). Unifies the two. */
function streamingToolToRecord(t: { id: string; tool: string; status: string; summary?: string; input?: unknown; output?: unknown; text_offset?: number }): ToolCallRecord {
  return {
    id: t.id,
    tool: t.tool,
    status: t.status === 'completed' || t.status === 'success' ? 'success'
      : t.status === 'error' ? 'error' : 'running',
    summary: t.summary,
    input: (t.input as ToolCallRecord['input']) ?? undefined,
    output: typeof t.output === 'string' ? t.output : (t.output != null ? JSON.stringify(t.output) : undefined),
    text_offset: t.text_offset,
  };
}

type Segment = { type: 'text'; text: string } | { type: 'tool'; tool: ToolCallRecord };

/** Split the assistant text by each tool's `text_offset` so the tool pills
 *  render interleaved between the text segments (like the OpenClaw chat).
 *  Tools without an offset (legacy rows / yield path) fall back to the end. */
function buildSegments(content: string, tools: ToolCallRecord[]): Segment[] {
  const withOffset = tools
    .filter((t) => typeof t.text_offset === 'number')
    .sort((a, b) => (a.text_offset! - b.text_offset!));
  const noOffset = tools.filter((t) => typeof t.text_offset !== 'number');
  const segs: Segment[] = [];
  if (withOffset.length === 0) {
    if (content.trim()) segs.push({ type: 'text', text: content });
    for (const t of tools) segs.push({ type: 'tool', tool: t });
    return segs;
  }
  let cursor = 0;
  for (const t of withOffset) {
    const off = Math.max(cursor, Math.min(t.text_offset!, content.length));
    if (off > cursor) {
      const slice = content.slice(cursor, off);
      if (slice.trim()) segs.push({ type: 'text', text: slice });
      cursor = off;
    }
    segs.push({ type: 'tool', tool: t });
  }
  if (cursor < content.length) {
    const tail = content.slice(cursor);
    if (tail.trim()) segs.push({ type: 'text', text: tail });
  }
  for (const t of noOffset) segs.push({ type: 'tool', tool: t });
  return segs;
}

/** Assistant markdown, extracted so each interleaved text segment renders with
 *  the same component set. */
function AssistantMarkdown({ content, onLinkClick }: { content: string; onLinkClick: (href: string) => void }) {
  return (
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
                onClick={() => onLinkClick(href)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '2px 8px', cursor: 'pointer',
                  color: 'var(--amber)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
              >
                {children}
              </button>
            );
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>{children}</a>;
        },
        pre: ({ children }) => (
          <div style={{ position: 'relative', margin: '8px 0' }}>
            <pre style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '12px 16px', overflow: 'auto',
              fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', margin: 0,
            }}>
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
          if (isBlock) return <code className={className} {...props}>{children}</code>;
          return (
            <code style={{
              background: 'var(--surface)', padding: '1px 4px', borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
            }} {...props}>{children}</code>
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
          <blockquote style={{ borderLeft: '2px solid var(--amber)', paddingLeft: 12, margin: '4px 0', color: 'var(--text-dim)' }}>
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '8px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>{children}</table>
          </div>
        ),
        th: ({ children }) => <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600 }}>{children}</th>,
        td: ({ children }) => <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  thinkingText?: string;
  isThinking?: boolean;
  tools?: { id: string; tool: string; status: string; summary: string; input?: unknown; output?: unknown }[];
  /** G9: previous message in the conv — used to compute `isFirstOfTurn` so
   *  consecutive bubbles from the same sender don't repeat the avatar. */
  previousMessage?: Message;
  /** G9: user avatar emoji from `useUserAvatar()`. Default '👤'. */
  userAvatar?: string;
}

/** Render a single line with **bold** segments (system-message chips). */
function renderInlineBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ fontStyle: 'normal' }}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  );
}

export function ChatMessage({ message, isStreaming, thinkingText, isThinking, tools, previousMessage, userAvatar = '👤' }: ChatMessageProps) {
  const navigate = useNavigate();
  const isUser = message.role === 'user';
  const agents = useChatStore((s) => s.agents);
  const { visibility } = useToolVisibility();

  // G9: sticky avatar — show only when this is the first message of a turn
  // (the previous message is either missing, a system chip, or from a
  // different sender). For sub-agent mirroring we compare both role AND
  // from_agent so two consecutive assistant messages from different agents
  // each show their own avatar.
  const previousSameSender = previousMessage
    && previousMessage.role !== 'system'
    && previousMessage.role === message.role
    && (previousMessage.agent ?? null) === (message.agent ?? null);
  const showAvatar = !previousSameSender;
  const agentInfo = !isUser && message.agent ? agents.find(a => a.name === message.agent) : null;

  // G10: side question render. The user's `/btw <question>` bubble is tagged
  // by chat.store.sendMessage. The assistant's reply that immediately follows
  // inherits the treatment (the previous user message was a side question and
  // there's been no other turn in between).
  const ownSide = message.message_metadata?.is_side_question === true;
  const inheritedSide = !isUser
    && previousMessage?.role === 'user'
    && previousMessage.message_metadata?.is_side_question === true;
  const isSide = ownSide || inheritedSide;
  const avatarEmoji = isUser ? userAvatar : (agentInfo?.avatar || '🤖');

  // Render approval card if this message carries an approval
  if (message.approval) {
    return <ApprovalCard approval={message.approval} />;
  }

  // Render gateway-down card when the gateway is unreachable
  if (message.model === '__gateway_down__') {
    return <GatewayDownCard />;
  }

  // Render error card for API errors (overloaded, rate limit, timeout, etc.)
  if (message.model === 'error') {
    return <ApiErrorCard message={message} />;
  }

  // Render system message (slash-command confirmation) as a discrete centered
  // gray chip — distinct from user/assistant bubbles. No avatar, no actions.
  // Content is dash-controlled (slash-command output), supports **bold** and
  // multi-line via \n.
  if (message.role === 'system') {
    const lines = message.content.split('\n');
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          maxWidth: '85%',
          padding: '6px 12px',
          borderRadius: 12,
          fontSize: '0.75rem',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
          background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)',
        }}>
          <Settings size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {lines.map((line, i) => (
              <span key={i}>{renderInlineBold(line)}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // U1: los comandos `/goal …` se gestionan desde el GoalChip del toolbar, no se
  // escriben. Si uno llega al historial, NO lo mostramos como burbuja de usuario
  // (texto crudo): lo renderizamos como un chip discreto centrado con contexto.
  if (isUser && /^\s*\/goal\b/i.test(message.content ?? '')) {
    const gm = /^\s*\/goal(?:\s+(\S+))?(?:\s+([\s\S]*?))?\s*$/i.exec(message.content ?? '');
    const sub = (gm?.[1] ?? 'status').toLowerCase();
    const rest = (gm?.[2] ?? '').trim();
    const labelMap: Record<string, string> = {
      start: 'Objetivo definido', set: 'Objetivo definido', create: 'Objetivo definido',
      pause: 'Objetivo pausado', resume: 'Objetivo reanudado',
      complete: 'Objetivo completado', done: 'Objetivo completado',
      block: 'Objetivo bloqueado', blocked: 'Objetivo bloqueado',
      clear: 'Objetivo borrado', status: 'Objetivo',
    };
    const label = labelMap[sub] ?? 'Objetivo';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, maxWidth: '85%',
          padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem',
          color: 'var(--text-muted)',
          background: 'color-mix(in srgb, #3b82f6 10%, transparent)',
        }}>
          <span>🎯 {label}{rest ? `: ${rest}` : ''}</span>
        </div>
      </div>
    );
  }

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

  // Parse [canvas_ready:description] from assistant messages
  const canvasReadyMatch = !isUser ? message.content.match(/\[canvas_ready:([^\]]+)\]/) : null;
  const canvasReadyDesc = canvasReadyMatch?.[1] ?? null;
  const displayContent = canvasReadyMatch
    ? message.content.replace(/\[canvas_ready:[^\]]+\]\s*/, '').trim()
    : message.content;
  const setActiveMode = useCanvasStore((s) => s.setActiveMode);

  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // G9: avatar slot (24px circle). When `showAvatar` is true we render the
  // emoji; when false we keep the same width as a transparent spacer so the
  // bubble stays aligned with the previous one (sticky avatar pattern).
  const avatarSize = 24;
  const avatarSlot = (
    <div style={{
      width: avatarSize, height: avatarSize, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(avatarSize * 0.72),
      lineHeight: 1,
      marginTop: 2,
      visibility: showAvatar ? 'visible' : 'hidden',
    }}>
      {avatarEmoji}
    </div>
  );

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <div
          style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            padding: '4px 0',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          {!isUser && avatarSlot}
          <div
            style={{
              position: 'relative',
              maxWidth: '85%',
              padding: '8px 12px',
              background: isSide
                ? 'transparent'
                : isUser ? 'var(--amber-dim)' : 'var(--card)',
              borderRadius: isUser
                ? '12px 12px 4px 12px'
                : '12px 12px 12px 4px',
              border: isSide
                ? '1px dashed var(--text-dim)'
                : (isUser ? 'none' : '1px solid var(--border)'),
              fontSize: '0.875rem',
              lineHeight: 1.5,
              wordBreak: 'break-word',
              opacity: isSide ? 0.85 : 1,
            }}
          >
            {isSide && (
              <span style={{
                position: 'absolute',
                bottom: -7,
                [isUser ? 'right' : 'left' as 'right' | 'left']: 10,
                fontSize: '0.5625rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                background: 'var(--surface)',
                padding: '1px 6px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                lineHeight: 1.4,
              }}>
                side
              </span>
            )}
            {isUser ? (
              <>
                {message.attachments && message.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.content && message.content !== '(attached files)' ? 6 : 0 }}>
                    {message.attachments.map((att) => (
                      <AttachmentChip key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
                {/* Sub-agent briefing badge — when this user-role
                    message is actually a task delegated by a parent
                    agent (mirror persisted `metadata.briefing=true`),
                    show a clear header so the user understands this
                    isn't their own input. */}
                {message.message_metadata?.briefing === true && (
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    🪄 Briefing de <strong style={{ color: 'var(--text-dim)' }}>{message.agent ?? 'parent agent'}</strong> al sub-agente
                  </div>
                )}
                {message.content && message.content !== '(attached files)' && (
                  <p style={{ margin: 0 }}>{message.content}</p>
                )}
              </>
            ) : (
              <div className="chat-markdown">
                {/* Interleave the tool pills between the text segments by each
                    tool's text_offset (like OpenClaw) — same per-tool renderer
                    for streaming AND finalized, filtered by visibility prefs. */}
                {(() => {
                  const rawTools: ToolCallRecord[] = isStreaming
                    ? (tools ?? []).map(streamingToolToRecord)
                    : (message.tool_calls ?? []);
                  const visibleTools = rawTools.filter((t) => shouldRenderTool(t.tool, visibility));
                  const segments = buildSegments(displayContent, visibleTools);
                  return segments.map((seg, i) =>
                    seg.type === 'text'
                      ? <AssistantMarkdown key={`txt-${i}`} content={seg.text} onLinkClick={handleLinkClick} />
                      : <div key={`tool-${seg.tool.id}`} style={{ margin: '4px 0' }}><ToolRenderer tool={seg.tool} /></div>,
                  );
                })()}
                {canvasReadyDesc && (
                  <button
                    onClick={() => setActiveMode('canvas')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      marginTop: 8,
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      color: 'var(--text)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-sans)',
                      textAlign: 'left',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <Layout size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{canvasReadyDesc}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Open Canvas</span>
                  </button>
                )}
              </div>
            )}
            {/* Tool pills now render INTERLEAVED inside the markdown block
                above (by text_offset), for both streaming and finalized. */}
            {/* Reasoning: animated dots while streaming with no text yet, then
                a collapsible chip (expanded while live, collapsed once done).
                Live thinkingText wins over persisted message.thinking until
                the stream finishes (see chat.store.finalizeStream). */}
            {isStreaming && isThinking && !thinkingText && (
              <div style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>Thinking</span>
                <span style={{ color: 'var(--amber)', fontSize: '1rem', fontWeight: 700, animation: 'dotFade 1.4s ease-in-out infinite', animationDelay: '0s' }}>.</span>
                <span style={{ color: 'var(--amber)', fontSize: '1rem', fontWeight: 700, animation: 'dotFade 1.4s ease-in-out infinite', animationDelay: '0.2s' }}>.</span>
                <span style={{ color: 'var(--amber)', fontSize: '1rem', fontWeight: 700, animation: 'dotFade 1.4s ease-in-out infinite', animationDelay: '0.4s' }}>.</span>
              </div>
            )}
            {(thinkingText || message.thinking) && (
              <ReasoningChip
                thinking={(thinkingText && thinkingText.length > 0 ? thinkingText : message.thinking) ?? ''}
                isStreaming={isStreaming && !!thinkingText}
              />
            )}
            {isStreaming && message.content && (
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
          {isUser && avatarSlot}
        </div>
      </TooltipTrigger>
      <TooltipContent side={isUser ? 'left' : 'right'}>
        {timeStr}{message.model ? ` · ${message.model}` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

function ApprovalCard({ approval }: { approval: MessageApproval }) {
  const [loading, setLoading] = useState(false);
  const [credentialInput, setCredentialInput] = useState('');
  const [showCredentialInput, setShowCredentialInput] = useState(false);
  const [error, setError] = useState('');
  const approveApproval = useSecurityStore((s) => s.approveApproval);
  const rejectApproval = useSecurityStore((s) => s.rejectApproval);
  const updateApprovalStatus = useChatStore((s) => s.updateApprovalStatus);

  const isPending = approval.status === 'pending';
  const isL3 = approval.level === 3;
  const expiresAt = new Date(approval.expires_at);
  const now = new Date();
  const minutesLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));
  const isExpired = minutesLeft <= 0 && isPending;

  const statusColor = {
    pending: 'var(--amber)',
    approved: '#22c55e',
    rejected: '#ef4444',
    expired: 'var(--text-dim)',
  }[approval.status];

  const statusLabel = {
    pending: isExpired ? 'Expired' : 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    expired: 'Expired',
  }[approval.status];

  const handleApprove = async () => {
    if (isL3 && !showCredentialInput) {
      setShowCredentialInput(true);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await approveApproval(approval.id, isL3 ? credentialInput : undefined);
      updateApprovalStatus(approval.id, 'approved');
    } catch (e: any) {
      const code = e?.response?.data?.error?.code || e?.message || 'Error';
      setError(
        code === 'INVALID_CREDENTIAL' || code === 'INVALID_PIN'
          ? 'PIN o contrasena incorrectos'
          : code === 'CREDENTIAL_REQUIRED' || code === 'PIN_REQUIRED'
            ? 'Se requiere PIN o contrasena'
            : 'Failed to approve',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setError('');
    setLoading(true);
    try {
      await rejectApproval(approval.id);
      updateApprovalStatus(approval.id, 'rejected');
    } catch {
      setError('Failed to reject');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '12px 16px',
          background: 'var(--card)',
          borderRadius: '12px 12px 12px 4px',
          border: `1px solid ${statusColor}`,
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{'\u{1F6E1}'}</span>
          <span style={{ fontWeight: 600, color: statusColor }}>
            Approval Required (L{approval.level})
          </span>
        </div>

        {/* Operation + summary */}
        <div style={{ marginBottom: 8, color: 'var(--text)' }}>
          <div style={{ fontWeight: 500 }}>{approval.operation}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>{approval.summary}</div>
        </div>

        {/* Expiry */}
        {isPending && !isExpired && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>
            Expires in {minutesLeft} min
          </div>
        )}

        {/* Status badge for resolved */}
        {!isPending && (
          <div style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: statusColor,
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: 4,
          }}>
            {statusLabel}
          </div>
        )}

        {/* Actions for pending */}
        {isPending && !isExpired && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {showCredentialInput && (
              <input
                type="password"
                placeholder="PIN o contrasena"
                value={credentialInput}
                onChange={(e) => setCredentialInput(e.target.value)}
                autoFocus
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                  width: 200,
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApprove(); }}
              />
            )}
            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleApprove}
                disabled={loading || (isL3 && showCredentialInput && !credentialInput)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#22c55e',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '...' : showCredentialInput ? 'Confirm' : 'Approve'}
              </button>
              <button
                onClick={handleReject}
                disabled={loading}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GatewayDownCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'idle' | 'started' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleStart = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await startGateway();
      setResult('started');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error al iniciar el Gateway');
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '12px 16px',
          background: 'var(--card)',
          borderRadius: '12px 12px 12px 4px',
          border: '1px solid var(--amber)',
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: 'var(--amber)' }}>Gateway detenido</span>
        </div>

        {result === 'idle' && (
          <>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 10 }}>
              El Gateway no está corriendo. ¿Quieres iniciarlo?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleStart}
                disabled={loading}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'Iniciando...' : 'Sí'}
              </button>
              <button
                onClick={() => setResult('error')}
                disabled={loading}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </>
        )}

        {result === 'started' && (
          <div style={{ color: '#22c55e', fontSize: '0.8125rem' }}>
            Gateway iniciado. Envía tu mensaje de nuevo.
          </div>
        )}

        {result === 'error' && !errorMsg && (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            Mensaje descartado.
          </div>
        )}

        {errorMsg && (
          <div style={{ color: '#ef4444', fontSize: '0.8125rem' }}>
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}

const ERROR_INFO: Record<string, { title: string; description: string; hint: string }> = {
  overloaded: {
    title: 'Servicio de IA saturado',
    description: 'Los servidores de IA estan temporalmente sobrecargados.',
    hint: 'Reintenta en unos segundos o prueba con un modelo mas rapido.',
  },
  rate_limit: {
    title: 'Limite de peticiones',
    description: 'Se ha superado el limite de peticiones a la API.',
    hint: 'Espera unos segundos antes de reintentar.',
  },
  timeout: {
    title: 'Tiempo de espera agotado',
    description: 'El agente no respondio a tiempo.',
    hint: 'Reintenta con un mensaje mas corto o verifica la conexion.',
  },
  network: {
    title: 'Error de conexion',
    description: 'No se pudo conectar con el Gateway.',
    hint: 'Verifica que el Gateway este corriendo.',
  },
  auth: {
    title: 'Error de autenticacion',
    description: 'No se pudo autenticar con el servicio de IA.',
    hint: 'Verifica la configuracion de la API key.',
  },
  subscription_expired: {
    title: 'Modelo no disponible',
    description: 'El proveedor devolvio 410 - el modelo ya no existe o la suscripcion ha caducado.',
    hint: 'Reasigna el agente a otro modelo en Gateway -> Models.',
  },
  payment_required: {
    title: 'Pago requerido',
    description: 'El proveedor agoto saldo o requiere pago.',
    hint: 'Recarga la cuenta del proveedor o usa otro modelo.',
  },
  model_unavailable: {
    title: 'Modelo no encontrado',
    description: 'El modelo ya no existe en el proveedor.',
    hint: 'Reasigna el agente a un modelo valido desde Gateway -> Models.',
  },
  service_unavailable: {
    title: 'Servicio no disponible',
    description: 'El proveedor esta temporalmente caido (503).',
    hint: 'Espera unos minutos o usa otro proveedor.',
  },
  sandbox_error: {
    title: 'Sandbox no configurado',
    description: 'El sandbox Docker del agente no esta construido todavia.',
    hint: 'Ve a Settings -> Sandbox y pulsa "Build image" (~2-5 min, sin terminal).',
  },
  unknown: {
    title: 'Error inesperado',
    description: 'Algo salio mal al procesar tu mensaje.',
    hint: 'Reintenta o consulta los logs para mas detalles.',
  },
};

function ApiErrorCard({ message }: { message: Message }) {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const messages = useChatStore((s) => s.messages);
  const navigate = useNavigate();
  const [retried, setRetried] = useState(false);
  const [showFullDetail, setShowFullDetail] = useState(false);

  const info = ERROR_INFO[message.error_type ?? 'unknown'] ?? ERROR_INFO.unknown!;
  // Para errores de "modelo roto" (proveedor 410/402/modelo eliminado) un
  // retry vuelve a fallar — el camino correcto es reasignar el modelo del
  // agente. Mostramos un botón extra que lleva a Gateway → Models.
  const isModelBroken =
    message.error_type === 'subscription_expired' ||
    message.error_type === 'payment_required' ||
    message.error_type === 'model_unavailable';
  // sandbox_error: el camino correcto NO es reasignar modelo — es construir
  // la imagen Docker del sandbox desde Settings → Sandbox.
  const isSandboxBroken = message.error_type === 'sandbox_error';

  // El backend envía el mensaje real (enriquecido para tipos conocidos, crudo
  // para 'unknown') en `message.content`. Antes lo descartábamos y solo
  // mostrábamos el `info.description` genérico — eso ocultaba info útil
  // como "Sandbox image not found: openclaw-sandbox:bookworm-slim". Ahora
  // lo renderizamos si no es trivial (no vacío, distinto de info.description).
  const rawDetail = (message.content ?? '').trim();
  const showRawDetail = rawDetail.length > 0 && rawDetail !== info.description;
  const DETAIL_TRUNC = 280;
  const detailTruncated = rawDetail.length > DETAIL_TRUNC && !showFullDetail
    ? rawDetail.slice(0, DETAIL_TRUNC) + '…'
    : rawDetail;

  const handleRetry = () => {
    // Find the last user message in this conversation
    const convMessages = messages.get(message.conversation_id) ?? [];
    const lastUserMsg = [...convMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setRetried(true);
      sendMessage(lastUserMsg.content, undefined, lastUserMsg.attachments);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '12px 16px',
          background: 'var(--card)',
          borderRadius: '12px 12px 12px 4px',
          border: '1px solid #ef4444',
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: '#ef4444' }}>{info.title}</span>
        </div>

        <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 4 }}>
          {info.description}
        </div>
        {showRawDetail && (
          <div style={{
            color: 'var(--text)',
            fontSize: '0.75rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
            marginBottom: 8,
            fontFamily: 'var(--font-mono, monospace)',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}>
            {detailTruncated}
            {rawDetail.length > DETAIL_TRUNC && (
              <button
                onClick={() => setShowFullDetail(v => !v)}
                style={{
                  marginLeft: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--amber)',
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  padding: 0,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {showFullDetail ? 'ocultar' : 'ver completo'}
              </button>
            )}
          </div>
        )}
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 10 }}>
          {info.hint}
        </div>

        {!retried ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isModelBroken && (
              <button
                onClick={() => navigate('/gateway?tab=models')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Wand2 size={14} />
                Reasignar modelo
              </button>
            )}
            {isSandboxBroken && (
              <button
                onClick={() => navigate('/settings/sandbox')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Wand2 size={14} />
                Configurar sandbox
              </button>
            )}
            <button
              onClick={handleRetry}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-md)',
                border: (isModelBroken || isSandboxBroken) ? '1px solid var(--border)' : 'none',
                background: (isModelBroken || isSandboxBroken) ? 'transparent' : 'var(--amber)',
                color: (isModelBroken || isSandboxBroken) ? 'var(--text)' : '#000',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Mensaje reenviado.
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({ attachment }: { attachment: ChatAttachment }) {
  const isImage = attachment.mime_type.startsWith('image/');
  const isPdf = attachment.mime_type === 'application/pdf';
  const sizeLabel = attachment.size_bytes < 1024
    ? `${attachment.size_bytes} B`
    : attachment.size_bytes < 1048576
      ? `${(attachment.size_bytes / 1024).toFixed(0)} KB`
      : `${(attachment.size_bytes / 1048576).toFixed(1)} MB`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.15)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.75rem',
        maxWidth: 200,
      }}
    >
      {attachment.preview_url ? (
        <img src={attachment.preview_url} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2 }} />
      ) : isImage ? (
        <ImageIcon size={14} />
      ) : isPdf ? (
        <FileText size={14} />
      ) : (
        <File size={14} />
      )}
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.filename}</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.6875rem' }}>{sizeLabel}</div>
      </div>
    </div>
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
