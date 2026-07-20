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
import { X, Pencil, Eye, Save, Loader2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentFile } from './hooks/use-agent-detail';
import { getAgentFileMeta } from './agent-file-meta';

/** Compact "≈Xk" token count for the per-file badge (prose ratio /4, same as backend). */
function fmtTok(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
}

interface AgentIdentityProps {
  agentId: string;
}

interface FileRowProps {
  filename: string;
  agentId: string;
}

function FileCard({ filename, agentId }: FileRowProps) {
  const { content, loading, save } = useAgentFile(agentId, filename);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hover, setHover] = useState(false);

  // Meta compartida (icono+color+label por tipo de fichero); ver agent-file-meta.
  const meta = getAgentFileMeta(filename) ?? { icon: FileText, color: 'var(--text-muted)', label: filename };
  const Icon = meta.icon;

  const handleOpen = useCallback((edit: boolean) => {
    if (content === null) return;
    if (edit) { setEditContent(content); setIsEditing(true); } else { setIsEditing(false); }
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
      <div
        onClick={() => handleOpen(false)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={loading ? 'Cargando…' : content === null ? 'No disponible' : `Ver ${filename}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', minWidth: 0,
          background: hover ? 'var(--surface-hover)' : 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          cursor: loading || content === null ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1, transition: 'var(--transition-fast)',
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, flexShrink: 0, borderRadius: 'var(--radius-sm)',
          background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color,
        }}>
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Icon size={13} />}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {filename.replace(/\.md$/, '')}
          </div>
          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {meta.label}
          </div>
        </div>
        {content !== null && (
          <span
            title="Tokens de contexto estimados de este bloque"
            style={{
              flexShrink: 0, fontSize: '0.5625rem', color: 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              padding: '1px 4px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}
          >
            ≈{fmtTok(Math.ceil(content.length / 4))}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handleOpen(true); }}
          disabled={loading || content === null}
          title="Editar"
          style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: loading || content === null ? 'default' : 'pointer', padding: 3,
            opacity: hover ? 1 : 0.5, transition: 'var(--transition-fast)',
          }}
        >
          <Pencil size={12} />
        </button>
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

const IDENTITY_FILES = ['IDENTITY.md', 'SOUL.md', 'TOOLS.md', 'USER.md', 'AGENTS.md', 'HEARTBEAT.md'];

export function AgentIdentity({ agentId }: AgentIdentityProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
        Identidad
      </h4>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 6,
      }}>
        {IDENTITY_FILES.map(f => (
          <FileCard key={f} filename={f} agentId={agentId} />
        ))}
      </div>
    </div>
  );
}
