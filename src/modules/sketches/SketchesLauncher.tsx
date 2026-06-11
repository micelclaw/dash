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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Waypoints, Shapes, Layout, Loader2, Pencil, Trash2, PenTool } from 'lucide-react';
import { api } from '@/services/api';
import { ContextMenu } from '@/components/shared/ContextMenu';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import type { FileRecord } from '@/types/files';
import type { ApiListResponse, ApiResponse } from '@/types/api';
import type { DiagramFile } from './types';

const DIAGRAM_MIME = 'application/vnd.claw.diagram+json';

interface TemplateInfo {
  type: string;
  label: string;
  description: string;
  node_count: number;
  edge_count: number;
}

export function SketchesLauncher() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [whiteboards, setWhiteboards] = useState<FileRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Fetch recent diagrams, whiteboards and templates
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [filesRes, wbRes, templatesRes] = await Promise.all([
          api.get<ApiListResponse<FileRecord>>('/files', {
            mime_type: DIAGRAM_MIME,
            sort: 'updated_at',
            order: 'desc',
            limit: 200,
          }),
          // Los whiteboards (Excalidraw) viven en /Tools/Whiteboards en Drive
          // (ubicación histórica — los archivos existentes siguen ahí).
          api.get<ApiListResponse<FileRecord>>('/files', {
            parent_folder: '/Tools/Whiteboards',
            sort: 'updated_at',
            order: 'desc',
            limit: 200,
          }).catch(() => ({ data: [] as FileRecord[] })),
          api.get<{ data: TemplateInfo[] }>('/diagrams/templates').catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setFiles(filesRes.data);
        setWhiteboards(wbRes.data);
        setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Create a new blank diagram
  const handleNewDiagram = useCallback(async () => {
    setCreating(true);
    try {
      const blank: DiagramFile = {
        version: '1.0.0',
        title: 'Untitled Diagram',
        description: '',
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
        settings: {
          snapToGrid: true,
          snapToGuides: true,
          gridSize: 20,
          showMinimap: true,
          showGrid: true,
          defaultEdgeType: 'smoothstep',
          connectionMode: 'loose',
          autoSave: true,
        },
      };
      const json = JSON.stringify(blank, null, 2);
      const blob = new Blob([json], { type: DIAGRAM_MIME });
      const formData = new FormData();
      formData.append('file', blob, 'Untitled.diagram');
      formData.append('parent_folder', '/Diagrams/');
      const res = await api.upload<ApiResponse<FileRecord>>('/files/upload', formData);
      navigate(`/sketches/${res.data.id}`);
    } catch {
      // Fallback: open editor without file
      navigate('/sketches/new');
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  // Load a template and create file
  const handleTemplate = useCallback(async (type: string) => {
    setCreating(true);
    try {
      const res = await api.get<{ data: DiagramFile }>(`/diagrams/templates/${type}`);
      const diagram = res.data;
      const json = JSON.stringify(diagram, null, 2);
      const blob = new Blob([json], { type: DIAGRAM_MIME });
      const formData = new FormData();
      formData.append('file', blob, `${diagram.title || type}.diagram`);
      formData.append('parent_folder', '/Diagrams/');
      const fileRes = await api.upload<ApiResponse<FileRecord>>('/files/upload', formData);
      navigate(`/sketches/${fileRes.data.id}`);
    } catch {
      navigate('/sketches/new');
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  // Delete a diagram
  const handleDelete = useCallback(async (file: FileRecord) => {
    try {
      await api.delete(`/files/${file.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch {
      // Silently fail
    }
  }, []);

  // Rename a diagram
  const handleRename = useCallback(async (fileId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const filename = trimmed.endsWith('.diagram') ? trimmed : `${trimmed}.diagram`;
    try {
      await api.patch(`/files/${fileId}`, { filename });
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, filename } : f));
    } catch {
      // Silently fail
    }
    setRenamingId(null);
  }, []);

  // Build context menu items for a diagram card
  const getContextItems = useCallback((file: FileRecord): ContextMenuItem[] => [
    {
      label: 'Rename',
      icon: Pencil,
      onClick: () => {
        setRenamingId(file.id);
        setRenameValue(file.filename.replace(/\.diagram$/, ''));
      },
    },
    { label: '', onClick: () => {}, separator: true },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      onClick: () => handleDelete(file),
    },
  ], [handleDelete]);

  // ─── Whiteboards (Excalidraw) — movidos desde Tools ─────────────────

  const handleDeleteWb = useCallback(async (file: FileRecord) => {
    try {
      await api.delete(`/files/${file.id}`);
      setWhiteboards((prev) => prev.filter((f) => f.id !== file.id));
    } catch { /* silently fail */ }
  }, []);

  const handleRenameWb = useCallback(async (fileId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const filename = trimmed.endsWith('.excalidraw') ? trimmed : `${trimmed}.excalidraw`;
    try {
      await api.patch(`/files/${fileId}`, { filename });
      setWhiteboards((prev) => prev.map((f) => f.id === fileId ? { ...f, filename } : f));
    } catch { /* silently fail */ }
    setRenamingId(null);
  }, []);

  const getWbContextItems = useCallback((file: FileRecord): ContextMenuItem[] => [
    {
      label: 'Rename',
      icon: Pencil,
      onClick: () => {
        setRenamingId(file.id);
        setRenameValue(file.filename.replace(/\.(excalidraw|json)$/, ''));
      },
    },
    { label: '', onClick: () => {}, separator: true },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      onClick: () => handleDeleteWb(file),
    },
  ], [handleDeleteWb]);

  // Format relative time
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto',
      padding: '32px 24px',
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shapes size={24} style={{ color: 'var(--mod-sketches, #06b6d4)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text, #e2e8f0)', margin: 0 }}>
            Sketches
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/sketches/whiteboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--text, #e2e8f0)',
              border: '1px solid var(--border, #333)',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans, system-ui)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--mod-sketches, #06b6d4)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border, #333)'; }}
          >
            <PenTool size={14} />
            New Whiteboard
          </button>
          <button
            onClick={handleNewDiagram}
            disabled={creating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: 'var(--amber, #d4a017)',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              cursor: creating ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans, system-ui)',
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            New Diagram
          </button>
        </div>
      </div>

      {/* Templates section */}
      {templates.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-dim, #64748b)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Layout size={12} />
            Templates
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}>
            {templates.map((t) => (
              <button
                key={t.type}
                onClick={() => handleTemplate(t.type)}
                disabled={creating}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 14,
                  background: 'var(--surface, #1a1a1a)',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 8,
                  cursor: creating ? 'wait' : 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--amber, #d4a017)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border, #333)'; }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text, #e2e8f0)', marginBottom: 4 }}>
                  {t.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-dim, #64748b)', lineHeight: 1.4 }}>
                  {t.description || `${t.node_count} nodes, ${t.edge_count} edges`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* All diagrams section */}
      <section>
        <h2 style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-dim, #64748b)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <Waypoints size={12} />
          Diagrams
        </h2>

        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 14,
                  background: 'var(--surface, #1a1a1a)',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 8,
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: 'var(--border, #333)',
                  }} />
                  <div style={{
                    height: 12,
                    width: '60%',
                    borderRadius: 4,
                    background: 'var(--border, #333)',
                  }} />
                </div>
                <div style={{
                  height: 10,
                  width: '40%',
                  borderRadius: 4,
                  background: 'var(--border, #333)',
                  opacity: 0.6,
                }} />
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-dim, #64748b)',
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            No diagrams yet. Create a new one or start from a template.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {files.map((file) => (
              <ContextMenu
                key={file.id}
                items={getContextItems(file)}
                trigger={
                  <button
                    onClick={() => {
                      if (renamingId !== file.id) navigate(`/sketches/${file.id}`);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      padding: 14,
                      background: 'var(--surface, #1a1a1a)',
                      border: `1px solid ${renamingId === file.id ? 'var(--mod-sketches, #06b6d4)' : 'var(--border, #333)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { if (renamingId !== file.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--mod-sketches, #06b6d4)'; }}
                    onMouseLeave={(e) => { if (renamingId !== file.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border, #333)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Waypoints size={16} style={{ color: 'var(--mod-sketches, #06b6d4)', flexShrink: 0 }} />
                      {renamingId === file.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRename(file.id, renameValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(file.id, renameValue);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 500,
                            fontFamily: 'var(--font-sans, system-ui)',
                            background: 'var(--background, #111)',
                            border: '1px solid var(--mod-sketches, #06b6d4)',
                            borderRadius: 4,
                            color: 'var(--text, #e2e8f0)',
                            padding: '2px 6px',
                            outline: 'none',
                            minWidth: 0,
                          }}
                        />
                      ) : (
                        <span style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--text, #e2e8f0)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {file.filename.replace(/\.diagram$/, '')}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-dim, #64748b)' }}>
                      {timeAgo(file.updated_at)}
                    </span>
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Whiteboards (Excalidraw) — sección hermana de los diagramas */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-dim, #64748b)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <PenTool size={12} />
          Whiteboards
        </h2>

        {whiteboards.length === 0 && !loading ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--text-dim, #64748b)',
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            No whiteboards yet. Use “New Whiteboard” to start drawing.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {whiteboards.map((wb) => (
              <ContextMenu
                key={wb.id}
                items={getWbContextItems(wb)}
                trigger={
                  <button
                    onClick={() => {
                      if (renamingId !== wb.id) navigate(`/sketches/whiteboard/${wb.id}`);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      padding: 14,
                      background: 'var(--surface, #1a1a1a)',
                      border: `1px solid ${renamingId === wb.id ? 'var(--mod-sketches, #06b6d4)' : 'var(--border, #333)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { if (renamingId !== wb.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--mod-sketches, #06b6d4)'; }}
                    onMouseLeave={(e) => { if (renamingId !== wb.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border, #333)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <PenTool size={16} style={{ color: 'var(--mod-sketches, #06b6d4)', flexShrink: 0 }} />
                      {renamingId === wb.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameWb(wb.id, renameValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameWb(wb.id, renameValue);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 500,
                            fontFamily: 'var(--font-sans, system-ui)',
                            background: 'var(--background, #111)',
                            border: '1px solid var(--mod-sketches, #06b6d4)',
                            borderRadius: 4,
                            color: 'var(--text, #e2e8f0)',
                            padding: '2px 6px',
                            outline: 'none',
                            minWidth: 0,
                          }}
                        />
                      ) : (
                        <span style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--text, #e2e8f0)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {wb.filename.replace(/\.(excalidraw|json)$/, '')}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-dim, #64748b)' }}>
                      {timeAgo(wb.updated_at)}
                    </span>
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
