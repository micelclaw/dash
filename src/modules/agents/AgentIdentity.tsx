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

import { useState, useCallback } from 'react';
import { X, Pencil, Eye, Save, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentFile } from './hooks/use-agent-detail';

interface AgentIdentityProps {
  agentId: string;
}

interface FileRowProps {
  filename: string;
  agentId: string;
}

function FileRow({ filename, agentId }: FileRowProps) {
  const { content, loading, save } = useAgentFile(agentId, filename);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewHover, setViewHover] = useState(false);
  const [editHover, setEditHover] = useState(false);

  const handleView = useCallback(() => {
    if (!content) return;
    setIsEditing(false);
    setShowModal(true);
  }, [content]);

  const handleEdit = useCallback(() => {
    if (content === null) return;
    setEditContent(content);
    setIsEditing(true);
    setShowModal(true);
  }, [content]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await save(editContent);
      setIsEditing(false);
    } catch { /* ignore */ }
    finally { setIsSaving(false); }
  }, [editContent, save]);

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
          <span style={{ opacity: 0.6 }}>{'\u{1F4C4}'}</span>
          <span>{filename}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleView}
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
            onClick={handleEdit}
            onMouseEnter={() => setEditHover(true)}
            onMouseLeave={() => setEditHover(false)}
            disabled={loading || content === null}
            style={{
              background: editHover && !loading && content !== null
                ? 'var(--surface-hover)'
                : 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '0.75rem',
              padding: '3px 10px',
              cursor: loading || content === null ? 'default' : 'pointer',
              opacity: loading || content === null ? 0.5 : 1,
              transition: 'var(--transition-fast)',
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
            zIndex: 'var(--z-modal)' as unknown as number,
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
              maxWidth: 700,
              width: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                {filename}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    if (!isEditing) { setEditContent(content ?? ''); setIsEditing(true); }
                    else { setIsEditing(false); }
                  }}
                  title={isEditing ? 'Preview' : 'Edit'}
                  style={{ background: 'none', border: 'none', color: isEditing ? 'var(--amber)' : 'var(--text-dim)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  {isEditing ? <Eye size={15} /> : <Pencil size={15} />}
                </button>
                {isEditing && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    title="Save"
                    style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: isSaving ? 'wait' : 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                  >
                    {isSaving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
                  </button>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } }}
                  spellCheck={false}
                  style={{
                    width: '100%', minHeight: 400, background: 'transparent', color: 'var(--text)',
                    border: 'none', outline: 'none', resize: 'vertical', padding: '16px 20px',
                    fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.7, tabSize: 2, boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{ padding: '16px 20px' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1.2em 0 0.6em', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.3em' }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '1em 0 0.5em', color: 'var(--text)' }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: '0.8em 0 0.4em', color: 'var(--text)' }}>{children}</h3>,
                      p: ({ children }) => <p style={{ margin: '0.5em 0', color: 'var(--text)', lineHeight: 1.7, fontSize: '0.8125rem' }}>{children}</p>,
                      ul: ({ children }) => <ul style={{ paddingLeft: '1.5em', margin: '0.5em 0' }}>{children}</ul>,
                      li: ({ children }) => <li style={{ margin: '0.2em 0', color: 'var(--text)', fontSize: '0.8125rem' }}>{children}</li>,
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)', textDecoration: 'none' }}>{children}</a>,
                      code: ({ children, ...props }) => <code style={{ background: 'var(--surface)', padding: '1px 5px', borderRadius: 3, fontSize: '0.85em', color: 'var(--amber)' }} {...props}>{children}</code>,
                      blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid var(--amber)', paddingLeft: '12px', margin: '0.5em 0', color: 'var(--text-dim)', fontStyle: 'italic' }}>{children}</blockquote>,
                      strong: ({ children }) => <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{children}</strong>,
                      em: ({ children }) => <em style={{ color: 'var(--text-dim)' }}>{children}</em>,
                      hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1em 0' }} />,
                    }}
                  >
                    {content || 'No content available'}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const IDENTITY_FILES = ['IDENTITY.md', 'SOUL.md', 'TOOLS.md', 'USER.md', 'AGENTS.md'];

export function AgentIdentity({ agentId }: AgentIdentityProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
        Identity
      </h4>
      {IDENTITY_FILES.map(f => (
        <FileRow key={f} filename={f} agentId={agentId} />
      ))}
    </div>
  );
}
