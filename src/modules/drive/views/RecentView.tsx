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

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Clock, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { FileIcon } from '@/components/shared/FileIcon';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { RenameDialog } from '@/components/shared/RenameDialog';
import { FolderPicker } from '@/components/shared/FolderPicker';
import { ShareModal } from '@/components/shared/ShareModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { useDriveStore } from '@/stores/drive.store';
import { api } from '@/services/api';
import { formatFileSize } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { useFilesQuery } from '../hooks/use-files-query';
import { useDriveShortcuts } from '../hooks/use-drive-shortcuts';
import { buildFileContextMenu, type DriveMenuContext } from '../context-menu';
import { DriveInspector } from '../components/inspector/DriveInspector';
import { ShareWithUserModal } from '../components/ShareWithUserModal';
import { ShareEmailModal } from '../components/ShareEmailModal';
import { TagsModal } from '../components/TagsModal';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

/**
 * Recent — two bands: "Hot now" (heat-ranked cards) and "Earlier"
 * (last-accessed list).
 *
 * D5: a single click selects the item and opens the right inspector;
 * double-click jumps to My Drive with ?id= (containing folder + selection).
 *
 * P2: both bands expose the full D4 context menu (buildFileContextMenu with
 * tab 'recent'), single-file always — Recent has no multi-select.
 */
export function RecentView() {
  const navigate = useNavigate();
  const clipboard = useFileClipboard();
  const setInspectorOpen = useDriveStore(s => s.setInspectorOpen);
  const setInspectorTab = useDriveStore(s => s.setInspectorTab);
  const hot = useFilesQuery({ sort: 'heat', order: 'desc', limit: 12, is_directory: false });
  const earlier = useFilesQuery({ sort: 'last_accessed', order: 'desc', limit: 60, is_directory: false });
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  // Modals (calqued from StarredView)
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null);
  const [folderPickerIds, setFolderPickerIds] = useState<string[] | null>(null);
  const [folderPickerMode, setFolderPickerMode] = useState<'move' | 'copy'>('move');
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [shareUserFiles, setShareUserFiles] = useState<FileRecord[] | null>(null);
  const [shareEmailFile, setShareEmailFile] = useState<FileRecord | null>(null);
  const [tagsFiles, setTagsFiles] = useState<FileRecord[] | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<Set<string> | null>(null);

  const anyModalOpen = !!renameTarget || folderPickerIds !== null || !!shareFile
    || !!shareUserFiles || !!shareEmailFile || !!tagsFiles || confirmDeleteIds !== null;

  const hotFiles = useMemo(
    () => hot.files.filter(f => (f.heat_score ?? 0) > 0),
    [hot.files],
  );

  const earlierFiles = useMemo(() => {
    const hotIds = new Set(hotFiles.map(f => f.id));
    return earlier.files.filter(f => !hotIds.has(f.id));
  }, [earlier.files, hotFiles]);

  const openInMyDrive = useCallback((file: FileRecord) => {
    navigate(`/drive?tab=my-drive&id=${file.id}`);
  }, [navigate]);

  // D5 — click selects (inspector), double-click navigates
  const handleSelect = useCallback((file: FileRecord) => {
    setSelectedFile(prev => prev?.id === file.id ? null : file);
  }, []);

  const refetchAll = useCallback(() => {
    void hot.refetch();
    void earlier.refetch();
  }, [hot.refetch, earlier.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mutations behind the context menu (P2) ─────────────

  const handleToggleStar = useCallback(async (targets: FileRecord[], starred: boolean) => {
    const ids = targets.map(f => f.id);
    if (ids.length === 0) return;
    try {
      if (ids.length === 1) {
        await api.patch<ApiResponse<FileRecord>>(`/files/${ids[0]}`, { starred });
      } else {
        await api.post('/files/bulk', { action: starred ? 'star' : 'unstar', ids });
      }
      toast.success(starred
        ? `${ids.length === 1 ? 'Starred' : `${ids.length} items starred`}`
        : `${ids.length === 1 ? 'Star removed' : `${ids.length} stars removed`}`);
      refetchAll();
    } catch {
      toast.error('Could not update stars');
    }
  }, [refetchAll]);

  const handleBulkDelete = useCallback(async () => {
    const ids = confirmDeleteIds ? [...confirmDeleteIds] : [];
    setConfirmDeleteIds(null);
    if (ids.length === 0) return;
    try {
      await api.post('/files/bulk', { action: 'delete', ids });
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} moved to trash`);
      setSelectedFile(prev => (prev && ids.includes(prev.id) ? null : prev));
      refetchAll();
    } catch {
      toast.error('Delete failed');
    }
  }, [confirmDeleteIds, refetchAll]);

  const handleRenameConfirm = useCallback(async (name: string) => {
    if (!renameTarget) return;
    try {
      await api.patch<ApiResponse<FileRecord>>(`/files/${renameTarget.id}`, { filename: name });
      refetchAll();
    } catch {
      toast.error('Rename failed');
    }
  }, [renameTarget, refetchAll]);

  const handleFolderPicked = useCallback(async (destPath: string) => {
    const ids = folderPickerIds ?? [];
    const mode = folderPickerMode;
    setFolderPickerIds(null);
    if (ids.length === 0) return;
    try {
      if (mode === 'move') {
        await api.post('/files/bulk', { action: 'move', ids, params: { parent_folder: destPath } });
        toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} moved`);
      } else {
        for (const id of ids) {
          await api.post(`/files/${id}/copy`, { dest_parent_folder: destPath });
        }
        toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} copied`);
      }
      refetchAll();
    } catch {
      toast.error(mode === 'move' ? 'Move failed' : 'Copy failed');
    }
  }, [folderPickerIds, folderPickerMode, refetchAll]);

  const openFolderPicker = useCallback((ids: string[], mode: 'move' | 'copy') => {
    setFolderPickerMode(mode);
    setFolderPickerIds(ids);
  }, []);

  // Clipboard (cut/copy — paste happens in My Drive / Explorer)
  const handleCut = useCallback((targets: FileRecord[]) => {
    if (targets.length === 0) return;
    clipboard.setClipboard('cut', targets.map(f => f.id), '/drive/');
    toast.success(`${targets.length} item${targets.length === 1 ? '' : 's'} cut`);
  }, [clipboard]);

  const handleCopy = useCallback((targets: FileRecord[]) => {
    if (targets.length === 0) return;
    clipboard.setClipboard('copy', targets.map(f => f.id), '/drive/');
    toast.success(`${targets.length} item${targets.length === 1 ? '' : 's'} copied`);
  }, [clipboard]);

  // ─── D4 context menu (single-file — Recent has no multi-select) ──

  const menuCtx: DriveMenuContext = useMemo(() => ({
    tab: 'recent',
    clipboard: { operation: clipboard.operation, fileIds: clipboard.fileIds },
    navigate,
    callbacks: {
      onOpen: openInMyDrive,
      // Details/Properties → inspector on the Details tab (D5)
      onPreview: (file) => {
        setSelectedFile(file);
        setInspectorTab('details');
        setInspectorOpen(true);
      },
      onToggleStar: (targets, starred) => { void handleToggleStar(targets, starred); },
      onShare: (file) => setShareFile(file),
      onShareUser: (targets) => setShareUserFiles(targets),
      onShareEmail: (file) => setShareEmailFile(file),
      onCut: handleCut,
      onCopy: handleCopy,
      onMoveTo: (targets) => openFolderPicker(targets.map(f => f.id), 'move'),
      onCopyTo: (targets) => openFolderPicker(targets.map(f => f.id), 'copy'),
      onRename: (file) => setRenameTarget(file),
      onTags: (targets) => setTagsFiles(targets),
      // Version history → inspector on the Versions tab (D5)
      onVersions: (file) => {
        setSelectedFile(file);
        setInspectorTab('versions');
        setInspectorOpen(true);
      },
      // Siempre con ConfirmDialog — también para un único archivo
      onDelete: (targets) => setConfirmDeleteIds(new Set(targets.map(f => f.id))),
    },
  }), [
    clipboard.operation, clipboard.fileIds, navigate, openInMyDrive,
    handleToggleStar, handleCut, handleCopy, openFolderPicker,
    setInspectorOpen, setInspectorTab,
  ]);

  const getContextMenuItems = useCallback(
    (file: FileRecord) => buildFileContextMenu([file], menuCtx),
    [menuCtx],
  );

  useDriveShortcuts({
    disabled: anyModalOpen,
    onEscape: () => { setSelectedFile(null); },
  });

  const loading = hot.loading || earlier.loading;
  const isEmpty = !loading && hotFiles.length === 0 && earlierFiles.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        icon={Clock}
        title="No recent activity"
        description="Files you open, edit or download will show up here, ranked by how hot they are."
        actions={[{ label: 'Browse My Drive', onClick: () => navigate('/drive?tab=my-drive'), variant: 'primary' }]}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* Hot now */}
        {hotFiles.length > 0 && (
          <section style={{ padding: '16px 16px 0' }}>
            <SectionHeader icon={Flame} label="Hot now" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 10,
              }}
            >
              {hotFiles.map(file => (
                <ContextMenu
                  key={file.id}
                  items={getContextMenuItems(file)}
                  trigger={
                    <HotCard
                      file={file}
                      selected={selectedFile?.id === file.id}
                      onClick={() => handleSelect(file)}
                      onDoubleClick={() => openInMyDrive(file)}
                    />
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Earlier */}
        <section style={{ padding: '16px 16px 24px' }}>
          <SectionHeader icon={Clock} label="Earlier" />
          {earlierFiles.length === 0 && !loading && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
              Nothing else accessed recently.
            </div>
          )}
          <div>
            {earlierFiles.map(file => (
              <ContextMenu
                key={file.id}
                items={getContextMenuItems(file)}
                trigger={
                  <RecentRow
                    file={file}
                    selected={selectedFile?.id === file.id}
                    onClick={() => handleSelect(file)}
                    onDoubleClick={() => openInMyDrive(file)}
                  />
                }
              />
            ))}
          </div>
          {loading && (
            <div style={{ padding: '8px 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              Loading…
            </div>
          )}
        </section>
      </div>

      {/* Inspector (D5) */}
      {selectedFile && (
        <DriveInspector
          files={[selectedFile]}
          onClose={() => setSelectedFile(null)}
          onRefetch={refetchAll}
        />
      )}

      {/* Modals (P2 — calqued from StarredView) */}
      {shareFile && (
        <ShareModal open={!!shareFile} file={shareFile} onClose={() => setShareFile(null)} />
      )}
      <ShareWithUserModal
        open={shareUserFiles !== null}
        files={shareUserFiles ?? []}
        onClose={() => setShareUserFiles(null)}
      />
      {shareEmailFile && (
        <ShareEmailModal open={!!shareEmailFile} file={shareEmailFile} onClose={() => setShareEmailFile(null)} />
      )}
      <TagsModal
        open={tagsFiles !== null}
        files={tagsFiles ?? []}
        onClose={() => setTagsFiles(null)}
        onSaved={refetchAll}
      />
      <FolderPicker
        open={folderPickerIds !== null}
        currentPath="/drive/"
        onSelect={(p) => { void handleFolderPicked(p); }}
        onCancel={() => setFolderPickerIds(null)}
      />
      <RenameDialog
        open={!!renameTarget}
        currentName={renameTarget?.filename ?? ''}
        title="New name:"
        onConfirm={(name) => { void handleRenameConfirm(name); }}
        onClose={() => setRenameTarget(null)}
      />
      <ConfirmDialog
        open={confirmDeleteIds !== null}
        onClose={() => setConfirmDeleteIds(null)}
        onConfirm={() => { void handleBulkDelete(); }}
        title={`Delete ${confirmDeleteIds?.size ?? 0} item${(confirmDeleteIds?.size ?? 0) === 1 ? '' : 's'}?`}
        description="They will be moved to the trash."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Icon size={14} style={{ color: 'var(--mod-drive)' }} />
      <span style={{
        fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)',
      }}>
        {label}
      </span>
    </div>
  );
}

function HotCard({ file, selected, onClick, onDoubleClick }: {
  file: FileRecord;
  selected?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={file.filename}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: selected ? '1px solid var(--mod-drive)' : '1px solid var(--border)',
        background: selected ? 'var(--amber-dim)' : hovered ? 'var(--surface-hover)' : 'var(--surface)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), box-shadow var(--transition-fast)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
        minWidth: 0,
      }}
    >
      <FileIcon mime={file.mime_type} isDirectory={false} size="md" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{
            fontSize: '0.8125rem', color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {file.filename}
          </span>
          <HeatBadge score={file.heat_score ?? 0} />
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>
          {file.last_accessed_at ? formatRelative(new Date(file.last_accessed_at)) : formatRelative(new Date(file.updated_at))}
          {typeof file.access_count === 'number' && file.access_count > 0 && ` · ${file.access_count} opens`}
        </div>
      </div>
    </div>
  );
}

function RecentRow({ file, selected, onClick, onDoubleClick }: {
  file: FileRecord;
  selected?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 140px',
        gap: 8,
        alignItems: 'center',
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        background: selected ? 'var(--amber-dim)' : hovered ? 'var(--surface-hover)' : 'transparent',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        color: 'var(--text)',
        transition: 'background var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FileIcon mime={file.mime_type} isDirectory={false} size="sm" />
        <span
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          title={file.filename}
        >
          {file.filename}
        </span>
        <HeatBadge score={file.heat_score ?? 0} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {formatFileSize(file.size_bytes)}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {file.last_accessed_at ? formatRelative(new Date(file.last_accessed_at)) : formatRelative(new Date(file.updated_at))}
      </span>
    </div>
  );
}
