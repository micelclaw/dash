import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, Reply, ReplyAll, Forward,
  MoreHorizontal, Star, BookOpen, FileText,
  Printer, ExternalLink, Trash2, Ban, ShieldAlert,
  AlertTriangle, Languages, Code, Download, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { formatDateLong, formatTime } from '@/lib/date-helpers';
import { useEmailLinks } from './hooks/use-email-links';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { MailThread } from './MailThread';
import type { Email, ComposeData } from './types';
import type { ApiResponse, ApiListResponse } from '@/types/api';

interface MailReadingPaneProps {
  emailId: string;
  onBack?: () => void;
  onReply: (data: Partial<ComposeData>) => void;
  onForward: (data: Partial<ComposeData>) => void;
  onNavigate?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DARK_MODE_STYLES = `<style>
body { background: #111118; color: #e2e2e6; font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; padding: 8px; }
a { color: #d4a017; }
img { max-width: 100%; }
blockquote { border-left: 3px solid #333; margin: 8px 0; padding-left: 12px; color: #999; }
</style>`;

function buildReplyData(email: Email, mode: 'reply' | 'reply_all' | 'forward'): Partial<ComposeData> {
  const prefix = mode === 'forward' ? 'Fwd' : 'Re';
  const subject = email.subject?.startsWith(`${prefix}: `) ? email.subject : `${prefix}: ${email.subject || ''}`;
  const quoted = `\n\n--- Original message ---\nFrom: ${email.from_name || email.from_address}\nDate: ${new Date(email.received_at).toLocaleString()}\n\n${email.body_plain || ''}`;
  const base: Partial<ComposeData> = {
    subject,
    body_html: quoted,
    in_reply_to: email.message_id || undefined,
    original_email: email,
  };
  if (mode === 'reply') {
    base.to = [{ address: email.from_address, name: email.from_name || undefined }];
  } else if (mode === 'reply_all') {
    base.to = [{ address: email.from_address, name: email.from_name || undefined }];
    base.cc = [...email.to_addresses, ...email.cc_addresses];
  }
  return base;
}

export function MailReadingPane({ emailId, onBack, onReply, onForward, onNavigate }: MailReadingPaneProps) {
  const [email, setEmail] = useState<Email | null>(null);
  const [threadEmails, setThreadEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const { linkedRecords, loading: linksLoading } = useEmailLinks(emailId);

  // Fetch email
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEmail(null);
    setThreadEmails([]);

    api.get<ApiResponse<Email>>(`/emails/${emailId}`)
      .then(async (res) => {
        if (cancelled) return;
        const fetched = res.data;
        setEmail(fetched);

        // Fetch thread if applicable
        if (fetched.thread_id) {
          try {
            const threadRes = await api.get<ApiListResponse<Email>>('/emails', {
              thread_id: fetched.thread_id,
              sort: 'received_at',
              order: 'asc',
            });
            if (!cancelled) setThreadEmails(threadRes.data);
          } catch {
            if (!cancelled) setThreadEmails([fetched]);
          }
        } else {
          if (!cancelled) setThreadEmails([fetched]);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Email not found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [emailId]);

  // Auto mark-as-read
  useEffect(() => {
    if (!email || email.is_read) return;
    const timer = setTimeout(() => {
      api.post(`/emails/${email.id}/read`).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [email]);

  // Close "More" dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  const handleReply = () => {
    if (!email) return;
    onReply(buildReplyData(email, 'reply'));
  };
  const handleReplyAll = () => {
    if (!email) return;
    onReply(buildReplyData(email, 'reply_all'));
  };
  const handleForward = () => {
    if (!email) return;
    onForward(buildReplyData(email, 'forward'));
  };

  const handleMarkUnread = () => {
    if (!email) return;
    api.post(`/emails/${email.id}/unread`).catch(() => {});
    setMoreOpen(false);
  };

  const handleToggleStar = () => {
    if (!email) return;
    const newVal = !email.is_starred;
    setEmail({ ...email, is_starred: newVal });
    api.post(`/emails/${email.id}/${newVal ? 'star' : 'unstar'}`).catch(() => {
      setEmail(prev => prev ? { ...prev, is_starred: !newVal } : prev);
    });
    setMoreOpen(false);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ padding: 16, background: 'var(--bg)', height: '100%', overflow: 'auto' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              border: 'none', background: 'transparent', color: 'var(--text-dim)',
              cursor: 'pointer', padding: '4px 0', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', marginBottom: 12,
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: i === 1 ? 24 : i === 2 ? 48 : 120,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 12,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  // Error
  if (error || !email) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: 'var(--bg)', fontFamily: 'var(--font-sans)',
          flexDirection: 'column', gap: 8,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              border: 'none', background: 'transparent', color: 'var(--text-dim)',
              cursor: 'pointer', padding: '4px 0', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        <BookOpen size={32} style={{ color: 'var(--text-muted)' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {error || 'Email not found'}
        </span>
      </div>
    );
  }

  const isThread = threadEmails.length > 1;

  // Thread view
  if (isThread) {
    return (
      <div
        style={{
          height: '100%',
          overflow: 'auto',
          background: 'var(--bg)',
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              border: 'none', background: 'transparent', color: 'var(--text-dim)',
              cursor: 'pointer', padding: '12px 16px 0', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        <MailThread
          emails={threadEmails}
          onReply={handleReply}
          onReplyAll={handleReplyAll}
          onForward={handleForward}
        />
        <div style={{ padding: '0 16px 16px' }}>
          <RelatedItemsPanel links={linkedRecords} loading={linksLoading} onNavigate={onNavigate} />
        </div>
      </div>
    );
  }

  // Single email view
  const receivedDate = new Date(email.received_at);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--bg)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            border: 'none', background: 'transparent', color: 'var(--text-dim)',
            cursor: 'pointer', padding: '12px 16px 0', fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}

      <div style={{ padding: '12px 16px' }}>
        {/* Subject */}
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          {email.subject ?? '(no subject)'}
        </h2>

        {/* From */}
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', marginBottom: 2 }}>
          <span style={{ fontWeight: 600 }}>{email.from_name ?? email.from_address}</span>
          {email.from_name && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
              &lt;{email.from_address}&gt;
            </span>
          )}
        </div>

        {/* To */}
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
          To: {email.to_addresses.map(a => a.name ?? a.address).join(', ')}
        </div>

        {/* CC */}
        {email.cc_addresses.length > 0 && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            CC: {email.cc_addresses.map(a => a.name ?? a.address).join(', ')}
          </div>
        )}

        {/* Date + attachment count */}
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-dim)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {formatDateLong(receivedDate)}, {formatTime(receivedDate)}
          </span>
          {email.has_attachments && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {email.attachments.length} attachment{email.attachments.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'var(--border)',
            margin: '12px 0',
          }}
        />

        {/* Body */}
        {email.body_html ? (
          <iframe
            srcDoc={DARK_MODE_STYLES + email.body_html}
            sandbox=""
            style={{ width: '100%', border: 'none', minHeight: 100, background: 'var(--bg)' }}
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentDocument) {
                iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
              }
            }}
          />
        ) : (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: '0.8125rem',
              color: 'var(--text)',
              lineHeight: 1.6,
            }}
          >
            {email.body_plain}
          </div>
        )}

        {/* Attachments */}
        {email.attachments.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-dim)',
                marginBottom: 6,
                borderTop: '1px solid var(--border)',
                paddingTop: 8,
              }}
            >
              Attachments ({email.attachments.length})
            </div>
            {email.attachments.map((att, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  fontSize: '0.8125rem',
                }}
              >
                <FileText size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <span
                  style={{
                    color: 'var(--text)', flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {att.filename}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                  {formatFileSize(att.size)}
                </span>
                <button
                  disabled
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    cursor: 'not-allowed',
                    opacity: 0.5,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related items */}
      <RelatedItemsPanel links={linkedRecords} loading={linksLoading} onNavigate={onNavigate} />

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          position: 'relative',
          flexWrap: 'wrap',
        }}
      >
        <ActionButton icon={Reply} label="Reply" onClick={handleReply} />
        <ActionButton icon={ReplyAll} label="Reply All" onClick={handleReplyAll} />
        <ActionButton icon={Forward} label="Forward" onClick={handleForward} />

        {/* Star button */}
        <button
          onClick={handleToggleStar}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title={email.is_starred ? 'Unstar' : 'Star'}
        >
          <Star
            size={14}
            fill={email.is_starred ? 'var(--amber)' : 'none'}
            style={{ color: email.is_starred ? 'var(--amber)' : 'var(--text-dim)' }}
          />
        </button>

        {/* Print button */}
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Print"
        >
          <Printer size={14} />
        </button>

        {/* New window */}
        <button
          onClick={() => toast.info('Open in new window — coming soon')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Open in new window"
        >
          <ExternalLink size={14} />
        </button>

        {/* More menu */}
        <div ref={moreRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onClick={() => setMoreOpen(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {moreOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 4,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 'var(--z-dropdown)' as unknown as number,
                minWidth: 180,
                padding: '4px 0',
                maxHeight: 360,
                overflowY: 'auto',
              }}
            >
              <button onClick={() => { handleReplyAll(); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <ReplyAll size={14} /> Reply all
              </button>
              <button onClick={() => { handleForward(); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Forward size={14} /> Forward
              </button>

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              <button onClick={handleMarkUnread} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <BookOpen size={14} /> Mark unread
              </button>
              <button onClick={() => { toast.info('Delete — coming soon'); setMoreOpen(false); }}
                style={{ ...menuItemStyle, color: 'var(--danger, #ef4444)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Trash2 size={14} /> Delete
              </button>

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              <button onClick={() => { toast.info('Block sender — coming soon'); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Ban size={14} /> Block sender
              </button>
              <button onClick={() => { toast.info('Report spam — coming soon'); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <ShieldAlert size={14} /> Report spam
              </button>
              <button onClick={() => { toast.info('Report phishing — coming soon'); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <AlertTriangle size={14} /> Report phishing
              </button>

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              <button onClick={() => { toast.info('Translate — coming soon'); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Languages size={14} /> Translate
              </button>
              <button onClick={() => { toast.info('Show original — coming soon'); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Code size={14} /> Show original
              </button>
              <button onClick={() => { toast.info('Download .eml — coming soon'); setMoreOpen(false); }} style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Download size={14} /> Download .eml
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Auto-reply stub */}
      <div style={{
        padding: '8px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <button
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          <Sparkles size={14} />
          AI Auto-reply
          <span style={{
            fontSize: '0.625rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1px 4px',
            fontWeight: 600,
          }}>
            Soon
          </span>
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        color: 'var(--text)',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  textAlign: 'left',
};
