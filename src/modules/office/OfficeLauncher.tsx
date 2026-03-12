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

// ─── Office Launcher ─────────────────────────────────────────────────
// Main Office module page with app switcher and recent documents.

import { useEffect, useState, useRef, useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText, Table2, Presentation, FileImage, Wrench,
  Plus, Loader2, Pencil, Copy, Trash2, Files,
} from 'lucide-react';
import { useOfficeStore, type OfficeApp, type RecentDoc } from '@/stores/office.store';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { api } from '@/services/api';

// ─── MIME groups per app tab ─────────────────────────────────────────

const APP_MIME_FILTER: Record<OfficeApp, string | undefined> = {
  documents: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  spreadsheets: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  presentations: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'pdf-viewer': 'application/pdf',
  'pdf-tools': undefined,
};

const APP_NEW_TYPE: Record<string, 'docx' | 'xlsx' | 'pptx' | null> = {
  documents: 'docx',
  spreadsheets: 'xlsx',
  presentations: 'pptx',
};

// ─── Per-tab icon + color config ─────────────────────────────────────

const APP_CARD_STYLE: Record<OfficeApp, { icon: typeof FileText; color: string }> = {
  documents:     { icon: FileText,     color: '#3b82f6' },   // blue
  spreadsheets:  { icon: Table2,       color: '#22c55e' },   // green
  presentations: { icon: Presentation, color: '#eab308' },   // yellow
  'pdf-viewer':  { icon: FileImage,    color: '#ef4444' },   // red
  'pdf-tools':   { icon: Wrench,       color: '#7f1d1d' },   // maroon
};

const TABS: { id: OfficeApp; label: string; icon: typeof FileText; color: string }[] = [
  { id: 'documents',     label: 'Documents',     icon: FileText,     color: '#3b82f6' },
  { id: 'spreadsheets',  label: 'Spreadsheets',  icon: Table2,       color: '#22c55e' },
  { id: 'presentations', label: 'Presentations',  icon: Presentation, color: '#eab308' },
  { id: 'pdf-viewer',    label: 'PDF Viewer',     icon: FileImage,    color: '#ef4444' },
  { id: 'pdf-tools',     label: 'PDF Tools',      icon: Wrench,       color: '#7f1d1d' },
];

// ─── Context Menu ────────────────────────────────────────────────────

interface ContextMenuState {
  doc: RecentDoc;
  x: number;
  y: number;
}

function FileContextMenu({ state, onClose, onAction }: {
  state: ContextMenuState;
  onClose: () => void;
  onAction: (action: string, doc: RecentDoc) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { id: 'rename',    label: 'Rename',       icon: Pencil },
    { id: 'copy',      label: 'Create copy',  icon: Files },
    { id: 'duplicate', label: 'Copy',         icon: Copy },
    { id: 'delete',    label: 'Delete',       icon: Trash2 },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: state.x, top: state.y, zIndex: 9999,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '4px 0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)', minWidth: 180,
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => { onAction(item.id, state.doc); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 14px', fontSize: 13, color: item.id === 'delete' ? '#ef4444' : 'var(--text)',
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={14} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Rename Dialog ───────────────────────────────────────────────────

function splitFilename(filename: string): [string, string] {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return [filename, ''];
  return [filename.slice(0, dot), filename.slice(dot)];
}

function copyName(filename: string): string {
  const [base, ext] = splitFilename(filename);
  const match = base.match(/^(.+?)\s*\((\d+)\)$/);
  if (match) return `${match[1]} (${Number(match[2]) + 1})${ext}`;
  return `${base} (1)${ext}`;
}

function RenameDialog({ doc, onClose, onConfirm }: {
  doc: RecentDoc;
  onClose: () => void;
  onConfirm: (newName: string) => void;
}) {
  const [base, ext] = splitFilename(doc.filename);
  const [name, setName] = useState(base);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== base) onConfirm(`${trimmed}${ext}`);
    else onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 20, width: 340,
        }}
      >
        <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)' }}>Rename</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              flex: 1, padding: '8px 10px', fontSize: 13,
              background: 'var(--bg)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {ext && (
            <span style={{
              padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)',
              background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: 'none',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              userSelect: 'none',
            }}>
              {ext}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" onClick={onClose} style={dialogBtnStyle}>Cancel</button>
          <button type="submit" style={{ ...dialogBtnStyle, background: 'var(--mod-office)', color: '#fff' }}>Rename</button>
        </div>
      </form>
    </div>
  );
}

const dialogBtnStyle: React.CSSProperties = {
  padding: '6px 16px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
  color: 'var(--text)', cursor: 'pointer',
};

// ─── Component ───────────────────────────────────────────────────────

export function Component() {
  const navigate = useNavigate();
  const { activeApp, setActiveApp, recentDocs, fetchRecentDocs, fetchStatus, status, loading } = useOfficeStore();
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<RecentDoc | null>(null);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    const mime = APP_MIME_FILTER[activeApp];
    if (mime) fetchRecentDocs(mime);
  }, [activeApp, fetchRecentDocs]);

  const newType = APP_NEW_TYPE[activeApp] ?? null;
  const cardStyle = APP_CARD_STYLE[activeApp];

  const handleNew = async () => {
    if (!newType) return;
    try {
      const session = await useOfficeStore.getState().createNewDocument(newType);
      navigate(`/office/edit/${session.fileId}`);
    } catch { /* toast error */ }
  };

  const handleOpenFile = (id: string, mime: string) => {
    if (mime === 'application/pdf') {
      navigate(`/office/pdf/${id}`);
    } else {
      navigate(`/office/edit/${id}`);
    }
  };

  const handleContextMenu = useCallback((e: MouseEvent, doc: RecentDoc) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ doc, x: e.clientX, y: e.clientY });
  }, []);

  const refreshDocs = useCallback(() => {
    const mime = APP_MIME_FILTER[activeApp];
    if (mime) fetchRecentDocs(mime);
  }, [activeApp, fetchRecentDocs]);

  const handleCtxAction = useCallback(async (action: string, doc: RecentDoc) => {
    switch (action) {
      case 'rename':
        setRenaming(doc);
        break;
      case 'copy': {
        const parentFolder = doc.parent_folder || doc.filepath.replace(/\/[^/]+$/, '/');
        const res = await api.post<{ data: { id: string } }>(`/files/${doc.id}/copy`, { dest_parent_folder: parentFolder });
        const newFilename = copyName(doc.filename);
        await api.patch(`/files/${res.data.id}`, { filename: newFilename });
        refreshDocs();
        break;
      }
      case 'duplicate': {
        const source = doc.parent_folder || doc.filepath.replace(/\/[^/]+$/, '/');
        useFileClipboard.getState().setClipboard('copy', [doc.id], source);
        break;
      }
      case 'delete':
        await api.delete(`/files/${doc.id}`);
        refreshDocs();
        break;
    }
  }, [refreshDocs]);

  const handleRename = useCallback(async (newName: string) => {
    if (!renaming) return;
    await api.patch(`/files/${renaming.id}`, { filename: newName });
    setRenaming(null);
    refreshDocs();
  }, [renaming, refreshDocs]);

  // PDF Tools navigates away
  useEffect(() => {
    if (activeApp === 'pdf-tools') navigate('/office/pdf/tools');
  }, [activeApp, navigate]);

  const CardIcon = cardStyle.icon;
  const cardColor = cardStyle.color;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* ─── Tab bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', overflowX: 'auto', flexShrink: 0,
      }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeApp === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveApp(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? tab.color : 'var(--text-dim)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: active ? `2px solid ${tab.color}` : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Content area ────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* New button */}
        {newType && (
          <button
            onClick={handleNew}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', marginBottom: 20,
              background: cardColor, color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
            New {activeApp === 'documents' ? 'Document' : activeApp === 'spreadsheets' ? 'Spreadsheet' : 'Presentation'}
          </button>
        )}

        {/* Recent documents grid */}
        {recentDocs.length > 0 ? (
          <>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 12 }}>Recent</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {recentDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleOpenFile(doc.id, doc.mime_type)}
                  onContextMenu={(e) => handleContextMenu(e, doc)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: 16, background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <CardIcon size={24} style={{ color: cardColor, marginBottom: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {doc.filename}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(doc.updated_at).toLocaleDateString()}
                    {doc.size_bytes > 0 && ` · ${Math.round(doc.size_bytes / 1024)} KB`}
                  </span>
                  {doc.filepath && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {doc.filepath}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, padding: '60px 0',
            color: 'var(--text-dim)',
          }}>
            <CardIcon size={40} strokeWidth={1} style={{ color: cardColor }} />
            <span style={{ fontSize: 14 }}>
              {newType ? 'Create your first document' : 'No recent files'}
            </span>
          </div>
        )}
      </div>

      {/* ─── Status bar ──────────────────────────────────── */}
      {status && (
        <div style={{
          display: 'flex', gap: 16, padding: '6px 16px', fontSize: 11,
          color: 'var(--text-muted)', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <StatusDot label="ONLYOFFICE" ok={status.onlyoffice.running} />
          <StatusDot label="Stirling PDF" ok={status.stirling_pdf.running} />
          <StatusDot label="Documenso" ok={status.documenso.running} />
        </div>
      )}

      {/* ─── Context Menu ─────────────────────────────────── */}
      {ctxMenu && (
        <FileContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onAction={handleCtxAction}
        />
      )}

      {/* ─── Rename Dialog ────────────────────────────────── */}
      {renaming && (
        <RenameDialog
          doc={renaming}
          onClose={() => setRenaming(null)}
          onConfirm={handleRename}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatusDot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: ok ? '#22c55e' : 'var(--text-muted)',
      }} />
      {label}
    </span>
  );
}
