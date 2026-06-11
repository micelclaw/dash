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

import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Star, StarOff, Trash2, Tags, UserPlus, FolderInput, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { RenameDialog } from '@/components/shared/RenameDialog';
import { FolderPicker } from '@/components/shared/FolderPicker';
import { ShareModal } from '@/components/shared/ShareModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useIsMobile } from '@/hooks/use-media-query';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { downloadFile, downloadBatch } from '@/lib/file-download';
import { api } from '@/services/api';
import { useFilesQuery } from '../hooks/use-files-query';
import { useDriveShortcuts } from '../hooks/use-drive-shortcuts';
import { buildFileContextMenu, type DriveMenuContext } from '../context-menu';
import { DriveGrid } from '../DriveGrid';
import { DriveList } from '../DriveList';
import { DrivePreview } from '../DrivePreview';
import { ShareWithUserModal } from '../components/ShareWithUserModal';
import { ShareEmailModal } from '../components/ShareEmailModal';
import { TagsModal } from '../components/TagsModal';
import { VersionHistoryDialog } from '../components/VersionHistoryDialog';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';
import type { DriveView } from '../types';

/**
 * Starred — GET /files?starred=true, reusing the Drive grid/list with the
 * D4 context menu, keyboard shortcuts and an expanded batch bar
 * (unstar / tags / share-with-user / move / download / delete).
 */
export function StarredView() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const clipboard = useFileClipboard();
  const { files, loading, error, refetch } = useFilesQuery({ starred: true, limit: 200 });

  const [view, setView] = useState<DriveView>(
    () => (localStorage.getItem('drive-view') as DriveView) || 'grid',
  );
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastToggleRef = useRef<string | null>(null);

  // Modals
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null);
  const [folderPickerIds, setFolderPickerIds] = useState<string[] | null>(null);
  const [folderPickerMode, setFolderPickerMode] = useState<'move' | 'copy'>('move');
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [shareUserFiles, setShareUserFiles] = useState<FileRecord[] | null>(null);
  const [shareEmailFile, setShareEmailFile] = useState<FileRecord | null>(null);
  const [tagsFiles, setTagsFiles] = useState<FileRecord[] | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileRecord | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<Set<string> | null>(null);

  const anyModalOpen = !!renameTarget || folderPickerIds !== null || !!shareFile
    || !!shareUserFiles || !!shareEmailFile || !!tagsFiles || !!versionsFile || confirmDeleteIds !== null;

  const changeView = useCallback((v: DriveView) => {
    setView(v);
    localStorage.setItem('drive-view', v);
  }, []);

  const toggleSelection = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastToggleRef.current) {
        const fromIdx = files.findIndex(f => f.id === lastToggleRef.current);
        const toIdx = files.findIndex(f => f.id === id);
        if (fromIdx >= 0 && toIdx >= 0) {
          for (let i = Math.min(fromIdx, toIdx); i <= Math.max(fromIdx, toIdx); i++) {
            next.add(files[i]!.id);
          }
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      lastToggleRef.current = id;
      return next;
    });
  }, [files]);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === files.length && files.length > 0 ? new Set() : new Set(files.map(f => f.id)),
    );
  }, [files]);

  // ─── Star / unstar (single + bulk) ──────────────────────

  const handleBulkStar = useCallback(async (targets: FileRecord[], starred: boolean) => {
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
      setSelectedIds(new Set());
      setSelectedFile(null);
      await refetch();
    } catch {
      toast.error('Could not update stars');
    }
  }, [refetch]);

  const handleUnstar = useCallback(async (file: FileRecord) => {
    await handleBulkStar([file], false);
  }, [handleBulkStar]);

  // ─── Delete ─────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.delete(`/files/${id}`);
      toast.success('Moved to trash');
      setSelectedFile(prev => prev?.id === id ? null : prev);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      await refetch();
    } catch {
      toast.error('Delete failed');
    }
  }, [refetch]);

  const handleBulkDelete = useCallback(async () => {
    const ids = confirmDeleteIds ? [...confirmDeleteIds] : [];
    setConfirmDeleteIds(null);
    if (ids.length === 0) return;
    try {
      await api.post('/files/bulk', { action: 'delete', ids });
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} moved to trash`);
      setSelectedIds(new Set());
      setSelectedFile(null);
      await refetch();
    } catch {
      toast.error('Bulk delete failed');
    }
  }, [confirmDeleteIds, refetch]);

  // ─── Rename / Move / Copy-to ────────────────────────────

  const handleRenameConfirm = useCallback(async (name: string) => {
    if (!renameTarget) return;
    try {
      await api.patch<ApiResponse<FileRecord>>(`/files/${renameTarget.id}`, { filename: name });
      await refetch();
    } catch {
      toast.error('Rename failed');
    }
  }, [renameTarget, refetch]);

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
      setSelectedIds(new Set());
      await refetch();
    } catch {
      toast.error(mode === 'move' ? 'Move failed' : 'Copy failed');
    }
  }, [folderPickerIds, folderPickerMode, refetch]);

  const openFolderPicker = useCallback((ids: string[], mode: 'move' | 'copy') => {
    setFolderPickerMode(mode);
    setFolderPickerIds(ids);
  }, []);

  // ─── Clipboard (cut/copy — paste happens in My Drive / Explorer) ──

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

  // ─── Download (batch) ───────────────────────────────────

  const handleBatchDownload = useCallback(() => {
    const selected = files.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    if (selected.length === 1) {
      const f = selected[0]!;
      void downloadFile(f.id, f.is_directory ? `${f.filename}.zip` : f.filename);
    } else {
      void downloadBatch(selected.map(f => f.id));
    }
  }, [files, selectedIds]);

  // ─── Open in My Drive ───────────────────────────────────

  const handleItemDoubleClick = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      const path = file.filepath.endsWith('/') ? file.filepath : file.filepath + '/';
      navigate(`/drive?tab=my-drive&path=${encodeURIComponent(path)}`);
    } else {
      navigate(`/drive?tab=my-drive&id=${file.id}`);
    }
  }, [navigate]);

  // ─── D4 context menu ────────────────────────────────────

  const selectedFiles = useMemo(
    () => files.filter(f => selectedIds.has(f.id)),
    [files, selectedIds],
  );

  const menuCtx: DriveMenuContext = useMemo(() => ({
    tab: 'starred',
    clipboard: { operation: clipboard.operation, fileIds: clipboard.fileIds },
    navigate,
    callbacks: {
      onOpen: handleItemDoubleClick,
      onPreview: (file) => setSelectedFile(file),
      onToggleStar: (targets, starred) => { void handleBulkStar(targets, starred); },
      onShare: (file) => setShareFile(file),
      onShareUser: (targets) => setShareUserFiles(targets),
      onShareEmail: (file) => setShareEmailFile(file),
      onCut: handleCut,
      onCopy: handleCopy,
      onMoveTo: (targets) => openFolderPicker(targets.map(f => f.id), 'move'),
      onCopyTo: (targets) => openFolderPicker(targets.map(f => f.id), 'copy'),
      onRename: (file) => setRenameTarget(file),
      onTags: (targets) => setTagsFiles(targets),
      onVersions: (file) => setVersionsFile(file),
      onDelete: (targets) => {
        if (targets.length === 1) void handleDelete(targets[0]!.id);
        else setConfirmDeleteIds(new Set(targets.map(f => f.id)));
      },
    },
  }), [
    clipboard.operation, clipboard.fileIds, navigate, handleItemDoubleClick,
    handleBulkStar, handleCut, handleCopy, openFolderPicker, handleDelete,
  ]);

  const getContextMenuItems = useCallback((file: FileRecord) => {
    const targets = selectedIds.has(file.id) && selectedIds.size > 1
      ? selectedFiles
      : [file];
    return buildFileContextMenu(targets, menuCtx);
  }, [selectedIds, selectedFiles, menuCtx]);

  // ─── Keyboard shortcuts (D4) ────────────────────────────

  useDriveShortcuts({
    disabled: anyModalOpen,
    onCopy: () => {
      const targets = selectedFiles.length > 0 ? selectedFiles : selectedFile ? [selectedFile] : [];
      if (targets.length > 0) handleCopy(targets);
    },
    onCut: () => {
      const targets = selectedFiles.length > 0 ? selectedFiles : selectedFile ? [selectedFile] : [];
      if (targets.length > 0) handleCut(targets);
    },
    onSelectAll: () => {
      if (files.length > 0 && selectedIds.size !== files.length) {
        setSelectedIds(new Set(files.map(f => f.id)));
      }
    },
    onDelete: () => {
      if (selectedIds.size > 0) setConfirmDeleteIds(new Set(selectedIds));
      else if (selectedFile) void handleDelete(selectedFile.id);
    },
    onRename: () => {
      const target = selectedIds.size === 1
        ? files.find(f => selectedIds.has(f.id))
        : selectedFile;
      if (target) setRenameTarget(target);
    },
    onOpen: () => {
      const target = selectedIds.size === 1
        ? files.find(f => selectedIds.has(f.id))
        : selectedFile;
      if (target) handleItemDoubleClick(target);
    },
    onEscape: () => {
      if (selectedIds.size > 0) setSelectedIds(new Set());
      else if (selectedFile) setSelectedFile(null);
    },
  });

  const hasSelection = selectedIds.size > 0;
  const cutIds = useMemo(
    () => (clipboard.operation === 'cut' ? new Set(clipboard.fileIds) : undefined),
    [clipboard.operation, clipboard.fileIds],
  );

  if (!loading && files.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No starred files"
        description="Mark files with the star to pin your favorites here."
        actions={[{ label: 'Browse My Drive', onClick: () => navigate('/drive?tab=my-drive'), variant: 'primary' }]}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* Mini toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <Star size={14} style={{ color: 'var(--amber)' }} fill="var(--amber)" />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
          {files.length} starred item{files.length === 1 ? '' : 's'}
        </span>
        <div style={{ flex: 1 }} />
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {/* Batch bar (D4: unstar / tags / share user / move / download / delete) */}
      {hasSelection && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 16px', background: 'var(--amber-dim)',
          borderBottom: '1px solid var(--border)', fontSize: '0.8125rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{selectedIds.size} selected</span>
          <div style={{ flex: 1 }} />
          <MiniButton icon={StarOff} label="Unstar" onClick={() => { void handleBulkStar(selectedFiles, false); }} />
          <MiniButton icon={Tags} label="Tags" onClick={() => setTagsFiles(selectedFiles)} />
          <MiniButton icon={UserPlus} label="Share" onClick={() => setShareUserFiles(selectedFiles)} />
          <MiniButton icon={FolderInput} label="Move" onClick={() => openFolderPicker([...selectedIds], 'move')} />
          <MiniButton icon={Download} label="Download" onClick={handleBatchDownload} />
          <MiniButton icon={Trash2} label="Delete" onClick={() => setConfirmDeleteIds(new Set(selectedIds))} danger />
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', padding: '4px 8px',
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {error && (
          <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--error)' }}>{error}</div>
        )}
        {view === 'grid' ? (
          <DriveGrid
            files={files}
            loading={loading}
            selectedFileId={selectedFile?.id ?? null}
            selectedIds={selectedIds}
            hasSelection={hasSelection}
            onItemClick={(f) => setSelectedFile(prev => prev?.id === f.id ? null : f)}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            getContextMenuItems={getContextMenuItems}
            onToggleStar={(f) => { void handleUnstar(f); }}
            cutIds={cutIds}
            isMobile={isMobile}
          />
        ) : (
          <DriveList
            files={files}
            loading={loading}
            selectedFileId={selectedFile?.id ?? null}
            selectedIds={selectedIds}
            onItemClick={(f) => setSelectedFile(prev => prev?.id === f.id ? null : f)}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleAll}
            getContextMenuItems={getContextMenuItems}
            onToggleStar={(f) => { void handleUnstar(f); }}
            cutIds={cutIds}
          />
        )}
      </div>

      {/* Preview */}
      {selectedFile && (
        <DrivePreview
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={(id) => { void handleDelete(id); }}
          isMobile={isMobile}
        />
      )}

      {/* Modals */}
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
        onSaved={() => { void refetch(); }}
      />
      {versionsFile && (
        <VersionHistoryDialog open={!!versionsFile} file={versionsFile} onClose={() => setVersionsFile(null)} />
      )}
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

function MiniButton({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
        color: danger ? 'var(--error)' : 'var(--text)',
        fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
