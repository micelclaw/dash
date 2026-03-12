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

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ExternalLink, X, Pencil, Eye, Save, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { api } from '@/services/api';
import { FileIcon } from '@/components/shared/FileIcon';
import { formatFileSize } from '@/lib/file-utils';
import type { FileRecord } from '@/types/files';
import type { ManagedAgent } from './types';

interface AgentWorkspacesProps {
  agents: ManagedAgent[];
  isMobile?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AgentWorkspaces({ agents, isMobile }: AgentWorkspacesProps) {
  const [selectedId, setSelectedId] = useState<string>(agents[0]?.id ?? '');
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Directory navigation state
  const [currentPath, setCurrentPath] = useState('');

  // Editor panel state
  const [openFile, setOpenFile] = useState<{ filepath: string; filename: string } | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resizable split state (percentage for the file-browser panel)
  const [splitPct, setSplitPct] = useState(50);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startPct: number } | null>(null);

  const selectedAgent = agents.find(a => a.id === selectedId);

  // Reset path and editor when agent changes
  useEffect(() => {
    setCurrentPath('');
    setOpenFile(null);
    setFileContent(null);
    setIsEditing(false);
    setIsDirty(false);
  }, [selectedId]);

  // Fetch workspace files when selected agent or path changes
  useEffect(() => {
    if (!selectedAgent) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    async function loadFiles() {
      setFilesLoading(true);
      try {
        const pathParam = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
        const res = await api.get<{ data: FileRecord[] }>(
          `/managed-agents/${selectedAgent!.id}/workspace${pathParam}`
        );
        if (!cancelled) setFiles(res.data);
      } catch {
        if (!cancelled) setFiles([]);
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    }
    loadFiles();
    return () => { cancelled = true; };
  }, [selectedAgent, currentPath]);

  // Navigate into a directory
  const handleDirClick = useCallback((file: FileRecord) => {
    setCurrentPath(file.filepath);
  }, []);

  // Navigate back one level
  const handleBack = useCallback(() => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length > 0 ? parts.join('/') : '');
  }, [currentPath]);

  // Open a file in the side panel
  const handleFileOpen = useCallback(async (file: FileRecord) => {
    if (!selectedAgent) return;
    setOpenFile({ filepath: file.filepath, filename: file.filename });
    setFileContent(null);
    setIsEditing(false);
    setIsDirty(false);

    try {
      const res = await api.get<{ data: { content: string } }>(
        `/managed-agents/${selectedAgent.id}/workspace-file?path=${encodeURIComponent(file.filepath)}`
      );
      setFileContent(res.data.content);
      setEditContent(res.data.content);
    } catch {
      setFileContent('Failed to load file.');
    }
  }, [selectedAgent]);

  // Handle file click: directory → navigate, text file → open panel
  const handleFileClick = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      handleDirClick(file);
    } else {
      handleFileOpen(file);
    }
  }, [handleDirClick, handleFileOpen]);

  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    if (isEditing && isDirty) {
      // switching back to preview — don't lose changes, user must save first
    }
    setIsEditing(prev => !prev);
  }, [isEditing, isDirty]);

  // Save file
  const handleSave = useCallback(async () => {
    if (!selectedAgent || !openFile) return;
    setIsSaving(true);
    try {
      await api.put(`/managed-agents/${selectedAgent.id}/workspace-file`, {
        path: openFile.filepath,
        content: editContent,
      });
      setFileContent(editContent);
      setIsDirty(false);
    } catch {
      // could show toast, but for now just ignore
    } finally {
      setIsSaving(false);
    }
  }, [selectedAgent, openFile, editContent]);

  // Close editor panel
  const handleClosePanel = useCallback(() => {
    setOpenFile(null);
    setFileContent(null);
    setIsEditing(false);
    setIsDirty(false);
  }, []);

  // Drag handlers for resizable split
  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startPct: splitPct };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [splitPct]);

  const handleDividerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !splitContainerRef.current) return;
    const totalW = splitContainerRef.current.offsetWidth;
    const delta = ((e.clientX - dragRef.current.startX) / totalW) * 100;
    const next = Math.min(80, Math.max(20, dragRef.current.startPct + delta));
    setSplitPct(next);
  }, []);

  const handleDividerPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Breadcrumb segments from currentPath
  const pathSegments = currentPath.split('/').filter(Boolean);

  // Is the open file a text file we can render as markdown?
  const isMarkdown = openFile?.filename.endsWith('.md');
  const isTextFile = openFile && /\.(md|txt|json|yaml|yml|toml|ts|js|py|sh)$/i.test(openFile.filename);

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* ── Agent selector ─────────────────────────────────── */}
      {isMobile ? (
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.avatar ?? '\u{1F916}'} {agent.display_name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{
          width: 200,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          {agents.map(agent => {
            const isSelected = agent.id === selectedId;
            const isHovered = agent.id === hoveredAgentId;
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedId(agent.id)}
                onMouseEnter={() => setHoveredAgentId(agent.id)}
                onMouseLeave={() => setHoveredAgentId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  background: isSelected
                    ? 'var(--surface-hover)'
                    : isHovered
                      ? 'var(--surface)'
                      : 'transparent',
                  borderLeft: isSelected
                    ? '3px solid var(--amber)'
                    : '3px solid transparent',
                  transition: 'var(--transition-fast)',
                }}
              >
                <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>
                  {agent.avatar ?? '\u{1F916}'}
                </span>
                <span style={{
                  fontSize: '0.8125rem',
                  color: isSelected ? 'var(--text)' : 'var(--text-dim)',
                  fontWeight: isSelected ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {agent.display_name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── File browser + editor wrapper (resizable) ────── */}
      <div ref={splitContainerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── File browser panel ─────────────────────────────── */}
      <div style={{
        flex: openFile ? undefined : 1,
        width: openFile && !isMobile ? `${splitPct}%` : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Path header with breadcrumbs + back arrow */}
        {selectedAgent && (
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {currentPath && (
              <button
                onClick={handleBack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-sm)',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                title="Back"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
              <span
                onClick={() => setCurrentPath('')}
                style={{
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                ~/workspace
              </span>
              {pathSegments.map((seg, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ margin: '0 2px', opacity: 0.5 }}>/</span>
                  <span
                    onClick={() => setCurrentPath(pathSegments.slice(0, i + 1).join('/'))}
                    style={{
                      cursor: 'pointer',
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {seg}
                  </span>
                </span>
              ))}
            </span>
          </div>
        )}

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filesLoading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              Loading files...
            </div>
          )}

          {!filesLoading && files.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              No files found in workspace.
            </div>
          )}

          {!filesLoading && files.map(file => {
            const isHovered = file.id === hoveredFileId;
            const isActive = openFile?.filepath === file.filepath;
            const isClickable = file.is_directory || isTextFile || /\.(md|txt|json|yaml|yml|toml|ts|js|py|sh)$/i.test(file.filename);
            return (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                onMouseEnter={() => setHoveredFileId(file.id)}
                onMouseLeave={() => setHoveredFileId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 16px',
                  cursor: isClickable ? 'pointer' : 'default',
                  background: isActive
                    ? 'var(--surface-hover)'
                    : isHovered
                      ? 'var(--surface)'
                      : 'transparent',
                  borderLeft: isActive ? '3px solid var(--amber)' : '3px solid transparent',
                  transition: 'var(--transition-fast)',
                }}
              >
                <FileIcon
                  mime={file.mime_type}
                  isDirectory={file.is_directory}
                  size="sm"
                />
                <span style={{
                  flex: 1,
                  fontSize: '0.8125rem',
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {file.filename}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  minWidth: 60,
                  textAlign: 'right',
                }}>
                  {file.is_directory ? '\u2014' : formatFileSize(file.size_bytes)}
                </span>
                {!openFile && (
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    minWidth: 60,
                    textAlign: 'right',
                  }}>
                    {formatRelativeTime(file.updated_at)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Resizable divider ────────────────────────────── */}
      {openFile && (
        <div
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={handleDividerPointerUp}
          style={{
            width: 4,
            flexShrink: 0,
            background: 'var(--border)',
            cursor: 'col-resize',
            touchAction: 'none',
            transition: dragRef.current ? 'none' : 'background var(--transition-fast)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--amber)'; }}
          onMouseLeave={e => { if (!dragRef.current) e.currentTarget.style.background = 'var(--border)'; }}
        />
      )}

      {/* ── Editor / Preview panel (resizable split) ─────── */}
      {openFile && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{
              flex: 1,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {openFile.filename}
              {isDirty && <span style={{ color: 'var(--amber)', marginLeft: 4 }}>*</span>}
            </span>

            {isTextFile && (
              <>
                {/* Toggle edit/preview */}
                <button
                  onClick={handleToggleEdit}
                  title={isEditing ? 'Preview' : 'Edit'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isEditing ? 'var(--amber)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; }}
                  onMouseLeave={e => { if (!isEditing) e.currentTarget.style.color = 'var(--text-dim)'; }}
                >
                  {isEditing ? <Eye size={15} /> : <Pencil size={15} />}
                </button>

                {/* Save button */}
                {isDirty && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    title="Save"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--amber)',
                      cursor: isSaving ? 'wait' : 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {isSaving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
                  </button>
                )}
              </>
            )}

            {/* Close */}
            <button
              onClick={handleClosePanel}
              title="Close"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {fileContent === null ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                Loading...
              </div>
            ) : isEditing ? (
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={e => { setEditContent(e.target.value); setIsDirty(true); }}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                spellCheck={false}
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  color: 'var(--text)',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: '16px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.7,
                  tabSize: 2,
                }}
              />
            ) : isMarkdown ? (
              <div
                className="prose prose-invert"
                style={{
                  padding: '16px 20px',
                  fontSize: '0.8125rem',
                  lineHeight: 1.7,
                  color: 'var(--text)',
                  maxWidth: 'none',
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    h1: ({ children }) => <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1.2em 0 0.6em', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.3em' }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '1em 0 0.5em', color: 'var(--text)' }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: '0.8em 0 0.4em', color: 'var(--text)' }}>{children}</h3>,
                    p: ({ children }) => <p style={{ margin: '0.5em 0', color: 'var(--text)' }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ paddingLeft: '1.5em', margin: '0.5em 0' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ paddingLeft: '1.5em', margin: '0.5em 0' }}>{children}</ol>,
                    li: ({ children }) => <li style={{ margin: '0.2em 0', color: 'var(--text)' }}>{children}</li>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)', textDecoration: 'none' }}>{children}</a>,
                    code: ({ className, children, ...props }) => {
                      const isBlock = className?.includes('language-');
                      if (isBlock) {
                        return (
                          <pre style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', overflow: 'auto', margin: '0.5em 0', fontSize: '0.8rem' }}>
                            <code className={className} {...props}>{children}</code>
                          </pre>
                        );
                      }
                      return <code style={{ background: 'var(--surface)', padding: '1px 5px', borderRadius: 3, fontSize: '0.85em', color: 'var(--amber)' }} {...props}>{children}</code>;
                    },
                    blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid var(--amber)', paddingLeft: '12px', margin: '0.5em 0', color: 'var(--text-dim)', fontStyle: 'italic' }}>{children}</blockquote>,
                    hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1em 0' }} />,
                    strong: ({ children }) => <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{children}</strong>,
                    em: ({ children }) => <em style={{ color: 'var(--text-dim)' }}>{children}</em>,
                    table: ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0.5em 0', fontSize: '0.8rem' }}>{children}</table>,
                    th: ({ children }) => <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', fontWeight: 600, background: 'var(--surface)' }}>{children}</th>,
                    td: ({ children }) => <td style={{ border: '1px solid var(--border)', padding: '6px 10px' }}>{children}</td>,
                  }}
                >
                  {fileContent}
                </ReactMarkdown>
              </div>
            ) : (
              <pre style={{
                padding: '16px 20px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                color: 'var(--text)',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.7,
              }}>
                {fileContent}
              </pre>
            )}
          </div>
        </div>
      )}

      </div>{/* end splitContainerRef wrapper */}
    </div>
  );
}
