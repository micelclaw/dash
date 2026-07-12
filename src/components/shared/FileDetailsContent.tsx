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
import {
  Pencil, Check, X, Copy, Download, Trash2, Star, Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { TagInput } from '@/components/shared/TagInput';
import { SharedWithIndicator } from '@/components/shared/SharedWithIndicator';
import { EntityShareModal } from '@/components/shared/EntityShareModal';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { FileThumbnail } from '@/components/shared/FileThumbnail';
import { formatFileSize, getMimeLabel } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { downloadFile } from '@/lib/file-download';
import { useCoNavigation } from '@/hooks/use-co-navigation';
import { useFileLinks } from '@/modules/drive/hooks/use-file-links';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

interface FileDetailsContentProps {
  file: FileRecord;
  /**
   * `vertical` = preview on top + stacked rows (Drive inspector).
   * `horizontal` = preview on the left + content column (File Explorer bottom panel).
   */
  layout?: 'vertical' | 'horizontal';
  /** Parent refetch (file lists) after a mutation. */
  onRefetch: () => void;
  /** Delete callback from the hosting view (moves to trash there). */
  onDelete?: (file: FileRecord) => void;
  /** Star toggle from the hosting view (so its list refreshes consistently). */
  onToggleStar?: (file: FileRecord, starred: boolean) => void;
  /** Close (clear selection) — shows an X in the header. */
  onClose?: () => void;
  /** Show the "Related items" panel (Drive) — File Explorer hides it. */
  showRelated?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route to open a file in its full viewer (only for DB-backed files). */
function fileViewerRoute(file: FileRecord): string | null {
  if (file.id.includes('/') || !UUID_RE.test(file.id)) return null; // VFS path → no deep viewer
  const mime = file.mime_type || '';
  if (mime === 'application/pdf') return `/office/pdf/${file.id}`;
  if (/wordprocessing|spreadsheet|presentation|msword|ms-excel|ms-powerpoint|opendocument|rtf/i.test(mime) || mime === 'text/csv') {
    return `/office/edit/${file.id}`;
  }
  if (mime.startsWith('image/')) return `/photos?id=${file.id}`;
  return null;
}

/**
 * Shared file "Details" content used by both the Drive inspector (vertical) and
 * the File Explorer bottom panel (horizontal): server-side preview (image + PDF/
 * office document thumbnails), inline rename, metadata (incl. heat / access),
 * editable tags, custom fields, sharing status and the AI panels. No Activity
 * or Versions — those live in the Drive inspector as separate tabs.
 */
export function FileDetailsContent({
  file: fileProp,
  layout = 'vertical',
  onRefetch,
  onDelete,
  onToggleStar,
  onClose,
  showRelated = true,
}: FileDetailsContentProps) {
  const navigate = useNavigate();
  useCoNavigation('file', fileProp.id);

  // Live copy — refreshed from GET /files/:id so heat/access fields are current
  // even when the hosting list returned a partial record.
  const [file, setFile] = useState<FileRecord>(fileProp);
  const { links, loading: linksLoading } = useFileLinks(file.id);

  useEffect(() => {
    setFile(fileProp);
    // VFS entries (id = path) aren't fetchable via /files/:id — keep the prop.
    if (fileProp.id.includes('/') || !UUID_RE.test(fileProp.id)) return;
    let cancelled = false;
    void api.get<ApiResponse<FileRecord>>(`/files/${fileProp.id}`)
      .then(res => { if (!cancelled) setFile(res.data); })
      .catch(() => { /* deleted/stale — keep the prop copy */ });
    return () => { cancelled = true; };
  }, [fileProp]);

  // ─── Rename inline ──────────────────────────────────────
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const startRename = () => { setNameDraft(file.filename); setRenaming(true); };
  const commitRename = async () => {
    const name = nameDraft.trim();
    setRenaming(false);
    if (!name || name === file.filename) return;
    try {
      const res = await api.patch<ApiResponse<FileRecord>>(`/files/${file.id}`, { filename: name });
      setFile(res.data);
      toast.success('Renamed');
      onRefetch();
    } catch {
      toast.error('Rename failed');
    }
  };

  // ─── Tags inline (immediate PATCH) ──────────────────────
  const handleTagsChange = useCallback(async (next: string[]) => {
    const prev = file.tags ?? [];
    setFile(f => ({ ...f, tags: next }));
    try {
      await api.patch<ApiResponse<FileRecord>>(`/files/${file.id}`, { tags: next });
      onRefetch();
    } catch {
      setFile(f => ({ ...f, tags: prev }));
      toast.error('Could not update tags');
    }
  }, [file.id, file.tags, onRefetch]);

  const copyChecksum = () => {
    if (!file.checksum_sha256) return;
    void navigator.clipboard.writeText(file.checksum_sha256);
    toast.success('Checksum copied');
  };

  const customFields = file.custom_fields && typeof file.custom_fields === 'object'
    ? Object.entries(file.custom_fields)
    : [];

  const viewerRoute = fileViewerRoute(file);
  const onOpen = viewerRoute ? () => navigate(viewerRoute) : undefined;
  const horizontal = layout === 'horizontal';

  // ─── Bloques componibles (el layout los agrupa distinto) ─
  const preview = (
    <div style={horizontal ? {
      width: 160, height: 120, flexShrink: 0, borderRadius: 'var(--radius-md)',
      overflow: 'hidden', background: 'var(--bg)',
    } : {
      height: 170, flexShrink: 0, background: 'var(--bg)',
      borderBottom: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <FileThumbnail key={file.id} file={file} width={640} fit="contain" iconSize="lg" onOpen={onOpen} textPreview retries="full" />
    </div>
  );

  const nameRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {renaming ? (
        <>
          <input
            value={nameDraft}
            autoFocus
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            style={{
              flex: 1, minWidth: 0, background: 'var(--surface)',
              border: '1px solid var(--mod-drive)', borderRadius: 'var(--radius-sm)',
              padding: '4px 8px', fontSize: '0.8125rem', color: 'var(--text)',
              fontFamily: 'var(--font-sans)', outline: 'none',
            }}
          />
          <IconBtn icon={Check} title="Save" onClick={() => { void commitRename(); }} />
          <IconBtn icon={X} title="Cancel" onClick={() => setRenaming(false)} />
        </>
      ) : (
        <>
          <h3
            title={file.filename}
            style={{
              margin: 0, flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 600,
              color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.filename}
          </h3>
          {file.starred && <Star size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} fill="var(--amber)" />}
          <IconBtn icon={Pencil} title="Rename" onClick={startRename} />
          {!horizontal && onClose && <IconBtn icon={X} title="Close" onClick={onClose} />}
        </>
      )}
    </div>
  );

  const metadataBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {!file.is_directory && <MetaRow label="Size" value={formatFileSize(file.size_bytes)} />}
      <MetaRow label="Type" value={getMimeLabel(file.mime_type)} title={file.mime_type} />
      <MetaRow label="Created" value={formatRelative(new Date(file.created_at))} title={file.created_at} />
      <MetaRow label="Modified" value={formatRelative(new Date(file.updated_at))} title={file.updated_at} />
      {(file.last_accessed_at || (file.access_count ?? 0) > 0) && (
        <MetaRow
          label="Last accessed"
          value={`${file.last_accessed_at ? formatRelative(new Date(file.last_accessed_at)) : '--'}${(file.access_count ?? 0) > 0 ? ` · ${file.access_count} opens` : ''}`}
          extra={<HeatBadge score={file.heat_score ?? 0} />}
        />
      )}
      {file.checksum_sha256 && (
        <MetaRow
          label="Checksum"
          value={`${file.checksum_sha256.slice(0, 12)}…`}
          title={file.checksum_sha256}
          extra={
            <button
              onClick={copyChecksum}
              title="Copy checksum"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 1, display: 'flex',
              }}
            >
              <Copy size={11} />
            </button>
          }
        />
      )}
      <MetaRow label="Path" value={file.filepath} title={file.filepath} />
    </div>
  );

  const tagsBlock = (
    <div>
      <SectionLabel>Tags</SectionLabel>
      <TagInput tags={file.tags ?? []} onChange={(next) => { void handleTagsChange(next); }} size="xs" />
    </div>
  );

  const customFieldsBlock = customFields.length > 0 ? (
    <div>
      <SectionLabel>Custom fields</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {customFields.map(([k, v]) => (
          <MetaRow key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
        ))}
      </div>
    </div>
  ) : null;

  const sharingBlock = <SharingSection file={file} />;

  const aiBlock = (
    <div>
      {showRelated && <RelatedItemsPanel links={links} loading={linksLoading} sourceType="file" sourceId={file.id} />}
      <SimilarContentPanel sourceType="file" sourceId={file.id} />
      <GraphProximityPanel sourceType="file" sourceId={file.id} />
    </div>
  );

  const actionsRow = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ActionBtn
        icon={Download}
        label="Download"
        onClick={() => { void downloadFile(file.id, file.is_directory ? `${file.filename}.zip` : file.filename); }}
      />
      {onToggleStar && (
        <ActionBtn
          icon={Star}
          label={file.starred ? 'Unstar' : 'Star'}
          onClick={() => {
            onToggleStar(file, !file.starred);
            setFile(f => ({ ...f, starred: !f.starred }));
          }}
        />
      )}
      {onDelete && (
        <ActionBtn icon={Trash2} label="Delete" variant="danger" onClick={() => onDelete(file)} />
      )}
    </div>
  );

  if (horizontal) {
    // Compacto: 3 bloques en línea (preview+nombre+metadatos | tags+custom+
    // sharing | IA+acciones) con wrap en anchos estrechos. La X cierra arriba
    // a la derecha del panel.
    return (
      <div style={{ position: 'relative', background: 'var(--surface)', fontFamily: 'var(--font-sans)', overflow: 'auto' }}>
        {onClose && (
          <div style={{ position: 'absolute', top: 8, right: 10, zIndex: 1 }}>
            <IconBtn icon={X} title="Close" onClick={onClose} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, padding: 12 }}>
          {/* Bloque 1: preview + nombre + metadatos */}
          <div style={{ display: 'flex', gap: 12, flex: '1.25 1 320px', minWidth: 300 }}>
            {preview}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {nameRow}
              {metadataBlock}
            </div>
          </div>
          {/* Bloque 2: tags + custom fields + sharing */}
          <div style={{ flex: '1 1 230px', minWidth: 210, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
            {tagsBlock}
            {customFieldsBlock}
            {sharingBlock}
          </div>
          {/* Bloque 3: paneles IA + acciones */}
          <div style={{ flex: '1 1 230px', minWidth: 210, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 20 }}>
            {aiBlock}
            {actionsRow}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {preview}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {nameRow}
        {metadataBlock}
        {tagsBlock}
        {customFieldsBlock}
        {sharingBlock}
        {aiBlock}
        {actionsRow}
      </div>
    </div>
  );
}

// ─── Sharing status (compacto: indicador + Gestionar → EntityShareModal) ──

function SharingSection({ file }: { file: FileRecord }) {
  const [manageOpen, setManageOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <SectionLabel>Sharing</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <SharedWithIndicator
          entityType="file"
          entityId={file.id}
          refreshKey={refreshKey}
          showLinkChip={!file.is_directory}
          onManage={() => setManageOpen(true)}
        />
        <button
          onClick={() => setManageOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Share2 size={12} /> Gestionar…
        </button>
      </div>

      {manageOpen && (
        <EntityShareModal
          open
          entityType="file"
          entityId={file.id}
          entityTitle={file.filename}
          shareMeta={{ mime: file.mime_type ?? undefined, isDirectory: file.is_directory }}
          initialSection="shared"
          onShared={() => setRefreshKey(k => k + 1)}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Small primitives ──────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function MetaRow({ label, value, title, extra }: {
  label: string;
  value: string;
  title?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
      <span style={{ width: 92, flexShrink: 0, color: 'var(--text-muted)' }}>{label}</span>
      <span
        title={title ?? value}
        style={{ flex: 1, minWidth: 0, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {value}
      </span>
      {extra}
    </div>
  );
}

function IconBtn({ icon: Icon, title, onClick, danger }: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
        color: danger ? 'var(--error)' : 'var(--text-muted)', display: 'flex', flexShrink: 0,
      }}
    >
      <Icon size={13} />
    </button>
  );
}

function ActionBtn({ icon: Icon, label, onClick, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: variant === 'danger' ? 'var(--error)' : 'var(--text-dim)',
        fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
