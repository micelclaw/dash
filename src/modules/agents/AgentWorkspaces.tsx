import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ExternalLink, X } from 'lucide-react';
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
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>(agents[0]?.id ?? '');
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedId);

  // Fetch workspace files when selected agent changes
  useEffect(() => {
    if (!selectedAgent) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    async function loadFiles() {
      setFilesLoading(true);
      try {
        const res = await api.get<{ data: FileRecord[] }>(
          '/files?parent_folder=' + encodeURIComponent(selectedAgent!.workspace_path)
        );
        if (!cancelled) {
          setFiles(res.data);
        }
      } catch {
        if (!cancelled) setFiles([]);
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    }
    loadFiles();
    return () => { cancelled = true; };
  }, [selectedAgent]);

  const handleFileClick = async (file: FileRecord) => {
    if (file.is_directory) return;
    if (!file.filename.endsWith('.md')) return;

    setPreviewFilename(file.filename);
    setPreviewOpen(true);
    setPreviewContent(null);

    try {
      const res = await api.get<{ data: { content: string } }>(
        `/files/${file.id}/content`
      );
      setPreviewContent(res.data.content);
    } catch {
      setPreviewContent('Preview not available');
    }
  };

  const handleOpenExplorer = () => {
    if (selectedAgent) {
      navigate(`/explorer?path=${encodeURIComponent(selectedAgent.workspace_path)}`);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Agent selector: dropdown on mobile, sidebar on desktop */}
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
                  {agent.avatar ?? '🤖'}
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

      {/* Right panel: file browser */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Path header */}
        {selectedAgent && (
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}>
            📁 {selectedAgent.workspace_path}
          </div>
        )}

        {/* File list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}>
          {filesLoading && (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '0.875rem',
            }}>
              Loading files...
            </div>
          )}

          {!filesLoading && files.length === 0 && (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '0.875rem',
            }}>
              No files found in workspace.
            </div>
          )}

          {!filesLoading && files.map(file => {
            const isHovered = file.id === hoveredFileId;
            const isClickable = !file.is_directory && file.filename.endsWith('.md');
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
                  background: isHovered ? 'var(--surface)' : 'transparent',
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
                  {file.is_directory ? '—' : formatFileSize(file.size_bytes)}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  minWidth: 60,
                  textAlign: 'right',
                }}>
                  {formatRelativeTime(file.updated_at)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {selectedAgent && (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button
              onClick={handleOpenExplorer}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--amber)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)';
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'var(--transition-fast)',
              }}
            >
              Open in File Explorer
              <ExternalLink size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Markdown preview modal */}
      {previewOpen && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 'var(--z-modal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          } as React.CSSProperties}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: 600,
              width: '90vw',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text)',
              }}>
                {previewFilename}
              </span>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 20,
            }}>
              {previewContent === null ? (
                <div style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  padding: 24,
                }}>
                  Loading...
                </div>
              ) : (
                <pre style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  color: 'var(--text)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                }}>
                  {previewContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
