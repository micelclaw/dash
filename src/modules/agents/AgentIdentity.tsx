import { useState } from 'react';
import { X } from 'lucide-react';
import { useAgentFile } from './hooks/use-agent-detail';

interface AgentIdentityProps {
  agentId: string;
}

interface FileRowProps {
  filename: string;
  content: string | null;
  loading: boolean;
}

function FileRow({ filename, content, loading }: FileRowProps) {
  const [showModal, setShowModal] = useState(false);
  const [viewHover, setViewHover] = useState(false);

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.8125rem',
          color: 'var(--text)',
        }}>
          <span>📄</span>
          <span>{filename}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowModal(true)}
            onMouseEnter={() => setViewHover(true)}
            onMouseLeave={() => setViewHover(false)}
            disabled={loading || !content}
            style={{
              background: viewHover && !loading && content
                ? 'var(--surface-hover)'
                : 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '0.75rem',
              padding: '3px 10px',
              cursor: loading || !content ? 'default' : 'pointer',
              opacity: loading || !content ? 0.5 : 1,
              transition: 'var(--transition-fast)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            View
          </button>
          <button
            disabled
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '0.75rem',
              padding: '3px 10px',
              cursor: 'not-allowed',
              opacity: 0.5,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Edit
          </button>
        </div>
      </div>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text)',
              }}>
                {filename}
              </span>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <pre style={{
              margin: 0,
              padding: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text)',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              flex: 1,
            }}>
              {content || 'No content available'}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

export function AgentIdentity({ agentId }: AgentIdentityProps) {
  const soul = useAgentFile(agentId, 'SOUL.md');
  const agentMd = useAgentFile(agentId, 'AGENT.md');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h4 style={{
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--text)',
        margin: 0,
        marginBottom: 4,
      }}>
        Identity
      </h4>
      <FileRow filename="SOUL.md" content={soul.content} loading={soul.loading} />
      <FileRow filename="AGENT.md" content={agentMd.content} loading={agentMd.loading} />
    </div>
  );
}
