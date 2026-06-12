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

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { X, Download, FileText, AlertCircle, Code, BookOpen } from 'lucide-react';
import { downloadFile } from '@/lib/file-download';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

/** Payload of GET /files/:id/content (snake_case end-to-end). */
interface FileContentPayload {
  file_id: string;
  filename: string;
  content_text: string;
  truncated: boolean;
  full_length_chars: number;
  returned_length_chars: number;
}

export function isMarkdownFile(file: FileRecord): boolean {
  return file.mime_type === 'text/markdown' || /\.(md|markdown)$/i.test(file.filename);
}

/** Slim markdown chrome (same approach as AppDetail's mdComponents). */
const mdComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '12px 16px',
      overflow: 'auto', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', margin: '8px 0',
    }}>
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    if (className?.startsWith('language-')) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code style={{
        background: 'var(--surface)', padding: '1px 4px',
        borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
      }} {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600 }}>
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
      {children}
    </td>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--mod-drive)' }}>
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote style={{
      borderLeft: '3px solid var(--border-hover)', margin: '8px 0',
      padding: '2px 12px', color: 'var(--text-dim)',
    }}>
      {children}
    </blockquote>
  ),
};

interface TextPreviewModalProps {
  /** Null = closed. */
  file: FileRecord | null;
  onClose: () => void;
}

/**
 * Inline text/markdown/code viewer (D6) — a large modal over the Drive (NOT
 * the inspector) backed by GET /files/:id/content. Markdown renders through
 * the repo's react-markdown stack (remark-gfm + rehype-highlight, themed via
 * the global `pre code.hljs` rules); everything else shows in a scrollable
 * <pre>. Truncated extracts get a visible indicator + Download CTA.
 */
export function TextPreviewModal({ file, onClose }: TextPreviewModalProps) {
  const [content, setContent] = useState<FileContentPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Markdown files start rendered; the toggle exposes the raw source.
  const [rawView, setRawView] = useState(false);

  useEffect(() => {
    if (!file) return;
    setContent(null);
    setError(null);
    setRawView(false);
    setLoading(true);
    let cancelled = false;
    void api.get<ApiResponse<FileContentPayload>>(`/files/${file.id}/content`)
      .then(res => { if (!cancelled) setContent(res.data); })
      .catch(() => { if (!cancelled) setError('Could not load the file content.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [file]);

  // Esc closes (window-level so it works wherever focus sits).
  useEffect(() => {
    if (!file) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [file, onClose]);

  if (!file) return null;

  const isMd = isMarkdownFile(file);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${file.filename}`}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 'min(900px, 94vw)',
          height: 'min(80vh, 900px)',
          fontFamily: 'var(--font-sans)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <FileText size={15} style={{ flexShrink: 0, color: 'var(--mod-drive)' }} />
          <h3
            title={file.filename}
            style={{
              margin: 0, flex: 1, minWidth: 0,
              fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {file.filename}
          </h3>

          {isMd && content && (
            <button
              onClick={() => setRawView(v => !v)}
              title={rawView ? 'Show rendered markdown' : 'Show raw source'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: 'transparent',
                color: 'var(--text-dim)', fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              {rawView ? <BookOpen size={13} /> : <Code size={13} />}
              {rawView ? 'Rendered' : 'Raw'}
            </button>
          )}

          <button
            onClick={() => { void downloadFile(file.id, file.filename); }}
            title="Download file"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'transparent',
              color: 'var(--text-dim)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Download size={13} /> Download
          </button>

          <button
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close preview"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Truncation banner */}
        {content?.truncated && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', flexShrink: 0,
            background: 'var(--amber-dim)', borderBottom: '1px solid var(--border)',
            fontSize: '0.75rem', color: 'var(--amber)',
          }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            Preview truncated — showing {content.returned_length_chars.toLocaleString()} of{' '}
            {content.full_length_chars.toLocaleString()} characters. Download the file for the full content.
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80, 95, 60, 88, 72].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 14, width: `${w}%`,
                    borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                    animation: 'drive-pulse 1.2s ease-in-out infinite',
                  }}
                />
              ))}
              <style>{'@keyframes drive-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.9; } }'}</style>
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--error)', fontSize: '0.8125rem',
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {content && !loading && !error && (
            isMd && !rawView ? (
              <div className="app-detail-md" style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                  {content.content_text}
                </ReactMarkdown>
              </div>
            ) : (
              <pre style={{
                margin: 0, fontSize: '0.8125rem', lineHeight: 1.55,
                fontFamily: 'var(--font-mono)', color: 'var(--text)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {content.content_text}
              </pre>
            )
          )}
        </div>
      </div>
    </div>
  );
}
