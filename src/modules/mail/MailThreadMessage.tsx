import { ChevronUp, FileText } from 'lucide-react';
import { formatEmailTime } from '@/lib/date-helpers';
import type { Email } from './types';

interface MailThreadMessageProps {
  email: Email;
  collapsed: boolean;
  onToggle: () => void;
  isLatest: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DARK_MODE_STYLES = `<style>
body { background: transparent; color: #e0e0e0; font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; padding: 8px; }
a { color: #d4a017; }
img { max-width: 100%; }
blockquote { border-left: 3px solid #333; margin: 8px 0; padding-left: 12px; color: #999; }
</style>`;

export function MailThreadMessage({ email, collapsed, onToggle, isLatest: _isLatest }: MailThreadMessageProps) {
  if (collapsed) {
    return (
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 4,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {email.from_name ?? email.from_address}
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          &mdash; {(email.body_plain ?? '').slice(0, 40)}
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatEmailTime(email.received_at)}
        </span>
      </div>
    );
  }

  // Expanded view
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 4,
        background: 'var(--surface)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '12px 12px 8px',
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text)' }}>
              {email.from_name ?? email.from_address}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              &lt;{email.from_address}&gt;
            </span>
          </div>
          {/* To / CC */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
            <span>
              To: {email.to_addresses.map(a => a.name ?? a.address).join(', ')}
            </span>
            {email.cc_addresses.length > 0 && (
              <span style={{ marginLeft: 12 }}>
                CC: {email.cc_addresses.map(a => a.name ?? a.address).join(', ')}
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatEmailTime(email.received_at)}
        </span>
        <button
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ChevronUp size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '0 12px 12px' }}>
        {email.body_html ? (
          <iframe
            srcDoc={DARK_MODE_STYLES + email.body_html}
            sandbox=""
            style={{ width: '100%', border: 'none', minHeight: 100 }}
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
      </div>

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
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
              <span style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  );
}
