import { useOfficeProviders } from './office-providers.store';
import {OfficeRecoveryPanel} from './OfficeRecoveryPanel';
import { officeFilenameSupported, preferredProvider, selectOfficeProvider } from './office-providers.service';
import { toast } from 'sonner';
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
import { useNavigate, useSearchParams } from 'react-router';
import {
  FileText, Table2, Presentation, FileImage, Database,
  Plus, Loader2, Pencil, Copy, Trash2, Files,
} from 'lucide-react';
import { useOfficeStore, type OfficeApp, type RecentDoc } from '@/stores/office.store';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { api } from '@/services/api';
import { DatabasesLauncherView } from './DatabasesLauncherView';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { useSettingsStore } from '@/stores/settings.store';
import { OFFICE_COLORS } from '@/config/office-colors';

// ─── MIME groups per app tab ─────────────────────────────────────────

const APP_MIME_FILTER: Record<OfficeApp, string | undefined> = {
  documents: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  spreadsheets: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  presentations: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  databases: undefined,
};

const APP_NEW_TYPE: Record<string, 'docx' | 'xlsx' | 'pptx' | null> = {
  documents: 'docx',
  spreadsheets: 'xlsx',
  presentations: 'pptx',
};

// ─── Per-tab icon + color config ─────────────────────────────────────

const APP_CARD_STYLE: Record<OfficeApp, { icon: typeof FileText; color: string }> = {
  documents:     { icon: FileText,     color: OFFICE_COLORS.documents },
  spreadsheets:  { icon: Table2,       color: OFFICE_COLORS.spreadsheets },
  presentations: { icon: Presentation, color: OFFICE_COLORS.presentations },
  pdf:           { icon: FileImage,    color: OFFICE_COLORS.pdf },
  databases:     { icon: Database,     color: '#a855f7' },   // purple
};

const TABS: { id: OfficeApp; label: string; icon: typeof FileText; color: string }[] = [
  { id: 'documents',     label: 'Documents',     icon: FileText,     color: OFFICE_COLORS.documents },
  { id: 'spreadsheets',  label: 'Spreadsheets',  icon: Table2,       color: OFFICE_COLORS.spreadsheets },
  { id: 'presentations', label: 'Presentations',  icon: Presentation, color: OFFICE_COLORS.presentations },
  { id: 'pdf',           label: 'PDF',            icon: FileImage,    color: OFFICE_COLORS.pdf },
  { id: 'databases',     label: 'Databases',      icon: Database,     color: '#a855f7' },
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
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const items = [
    { id: 'rename',    label: t('office.launcher.rename'),     icon: Pencil },
    { id: 'copy',      label: t('office.launcher.createCopy'), icon: Files },
    { id: 'duplicate', label: t('office.launcher.copy'),       icon: Copy },
    { id: 'delete',    label: t('office.launcher.delete'),     icon: Trash2 },
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
  const { t } = useI18n();
  const [base, ext] = splitFilename(doc.filename);
  const [name, setName] = useState(base);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)' }}>{t('office.launcher.rename')}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <input
            ref={inputRef}
            aria-label={t('office.launcher.renameFile')}
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
          <button type="button" onClick={onClose} style={dialogBtnStyle}>{t('office.launcher.cancel')}</button>
          <button type="submit" style={{ ...dialogBtnStyle, background: 'var(--mod-office)', color: '#fff' }}>{t('office.launcher.rename')}</button>
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
  const { t, locale } = useI18n();
  const general = useSettingsStore((s) => s.serverSettings?.general);
  const navigate = useNavigate();
  const [query,setQuery] = useSearchParams();
  const office = useOfficeProviders();
  useEffect(() => { void office.refresh(); }, [office.refresh]);

  const { activeApp, setActiveApp, recentDocs: storedRecentDocs, fetchRecentDocs, loading, docsLoading, creatingProvider, creationError, createProviderDocument } = useOfficeStore();
  const provider = activeApp === 'databases' ? undefined : preferredProvider(office.providers, activeApp);
  // Filter at render as well: a provider/grant change must not expose stale cards.
  const recentDocs = storedRecentDocs.filter(file => officeFilenameSupported(file.filename, provider?.formats ?? []));
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<RecentDoc | null>(null);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => { const app=query.get('app');if(TABS.some(tab=>tab.id===app))setActiveApp(app as OfficeApp); },[query,setActiveApp]);

  useEffect(() => {
    const mime = APP_MIME_FILTER[activeApp];
    if (mime) fetchRecentDocs(mime, provider?.formats ?? []);
  }, [activeApp, fetchRecentDocs, provider]);

  const newType = APP_NEW_TYPE[activeApp] ?? null;
  const cardStyle = APP_CARD_STYLE[activeApp];

  const handleNew = async () => {
    if ((!newType && activeApp !== 'pdf') || !office.loaded || office.error) return;
    try {
      if (provider) { const session = await createProviderDocument(provider.app_name); if (session) navigate(session.editor_url); return; }
      toast.error(t('office.launcher.chooseAuthorized'));
    } catch (error) { toast.error(error instanceof Error ? error.message : t('office.launcher.createError')); }
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
    if (mime) fetchRecentDocs(mime, provider?.formats ?? []);
  }, [activeApp, fetchRecentDocs, provider]);

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

  // Databases y PDF se quedan EN el launcher (rejilla nativa de recientes); ya no hay
  // redirect a un iframe al pulsar la tab.

  const CardIcon = cardStyle.icon;
  const cardColor = cardStyle.color;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* ─── Tab bar ─────────────────────────────────────── */}
      <div role="tablist" style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', overflowX: 'auto', flexShrink: 0,
      }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeApp === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => {setActiveApp(tab.id);setQuery(previous=>{const next=new URLSearchParams(previous);next.set('app',tab.id);return next;},{replace:true});}}
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
              {t(`office.tabs.${tab.id}`)}
            </button>
          );
        })}
      </div>

      {/* ─── Content area ────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {activeApp === 'databases' ? (
          <DatabasesLauncherView />
        ) : (
        <>
        {office.providers.some(p => p.slot === activeApp) && (
          <label className="mb-4 flex items-center gap-2 text-sm">
            {t('office.launcher.application')}
            <select value={provider?.app_name ?? ''} disabled={selecting} onChange={async event => {
              const name = event.target.value;
              if (!name) return;
              setSelecting(true);
              try { await selectOfficeProvider(activeApp, name); await office.refresh(); }
              catch (error) { toast.error(error instanceof Error ? error.message : t('office.launcher.selectError')); }
              finally { setSelecting(false); }
            }}>
              <option value="" disabled>{t('office.launcher.chooseApp')}</option>
              {office.providers.filter(p => p.slot === activeApp).map(p => <option key={p.app_name} value={p.app_name}>{p.app_name}</option>)}
            </select>
          </label>
        )}
        {/* New button */}
        {(newType || activeApp === 'pdf') && (
          <button
            onClick={handleNew}
            disabled={loading || !!creatingProvider || !office.loaded || !!office.error || !provider}
            aria-busy={!!creatingProvider}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', marginBottom: 20,
              background: cardColor, color: activeApp === 'documents' ? '#111827' : '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}
          >
            {loading || creatingProvider ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
            {creatingProvider === provider?.app_name ? t('office.new.creating', { type: newType ?? 'PDF' }) : t(activeApp === 'documents' ? 'office.launcher.newDocument' : activeApp === 'spreadsheets' ? 'office.launcher.newSpreadsheet' : activeApp === 'pdf' ? 'office.launcher.newPdf' : 'office.launcher.newPresentation')}
          </button>
        )}
        <button onClick={() => navigate('/drive')} style={{ ...dialogBtnStyle, marginLeft: 10, marginBottom: 20 }}>
          {t('office.launcher.openDrive')}
        </button>

        {creationError && creationError.provider === provider?.app_name && <p role="alert" className="mb-4 text-sm text-red-400">
          {creationError.message || t('office.launcher.createError')}
        </p>}

        {office.loaded && !provider && <div role="status" className="mb-4 flex items-center gap-3 text-sm">
          <span>{t('office.launcher.chooseAuthorized')}</span>
          <button onClick={() => navigate('/micelhub')}>{t('office.launcher.manage')}</button>
        </div>}

        {/* Recent documents grid */}
        <OfficeRecoveryPanel slot={activeApp} enabled={office.platform_ready}/>
        {docsLoading && recentDocs.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, padding: '60px 0',
            color: 'var(--text-dim)',
          }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: cardColor }} />
            <span style={{ fontSize: 13 }}>{t('office.launcher.loading')}</span>
          </div>
        ) : recentDocs.length > 0 ? (
          <>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 12 }}>{t('office.launcher.recent')}</h3>
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
                    {formatDate(new Date(doc.updated_at), locale, general, general?.timezone)}
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
              {t(newType ? 'office.launcher.first' : 'office.launcher.empty')}
            </span>
          </div>
        )}
        </>
        )}
      </div>

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
