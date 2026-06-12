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

import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { FolderInput, Download, Trash2, Star, StarOff, Tags, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { DropZone } from '@/components/shared/DropZone';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { RenameDialog } from '@/components/shared/RenameDialog';
import { FolderPicker } from '@/components/shared/FolderPicker';
import { ShareModal } from '@/components/shared/ShareModal';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { useNotificationStore } from '@/stores/notification.store';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { downloadFile, downloadBatch } from '@/lib/file-download';
import { isImageMime } from '@/lib/file-utils';
import { api } from '@/services/api';
import { useDriveStore } from '@/stores/drive.store';
import { useDrive } from '../hooks/use-drive';
import { useDriveShortcuts } from '../hooks/use-drive-shortcuts';
import { useUploadQueue } from '../hooks/use-upload-queue';
import {
  buildFileContextMenu, buildBackgroundContextMenu, playFromDrive,
  isPdfFile, isAudioFile, isVideoFile, isOfficeFile, isDiagramFile, isTextPreviewable,
  type DriveMenuContext,
} from '../context-menu';
import { DriveToolbar } from '../DriveToolbar';
import { DriveGrid } from '../DriveGrid';
import { DriveList } from '../DriveList';
import { DriveInspector } from '../components/inspector/DriveInspector';
import { DriveLightbox } from '../components/DriveLightbox';
import { TextPreviewModal } from '../components/TextPreviewModal';
import { UploadQueuePanel } from '../components/UploadQueuePanel';
import { ShareWithUserModal } from '../components/ShareWithUserModal';
import { ShareEmailModal } from '../components/ShareEmailModal';
import { TagsModal } from '../components/TagsModal';
import type { FileRecord } from '@/types/files';

/**
 * My Drive — the classic folder-browsing view (toolbar + grid/list +
 * multi-select + drag-to-folder + batch bar + preview + modals).
 *
 * D4 additions: rich context menu (builder in ../context-menu.tsx), real
 * Cut/Copy/Paste through the shared file clipboard, keyboard shortcuts,
 * expanded batch bar (star/tags/share-with-user) and the new share modals.
 *
 * D5: the bottom DrivePreview is replaced by the right-hand DriveInspector
 * (Details | Activity | Versions, multi-select aggregate summary).
 *
 * D6: double-click / "Open" dispatches by mime (image → lightbox, text/md →
 * inline viewer, pdf → /office/pdf, audio/video → global player, office →
 * ONLYOFFICE, diagram → Sketches, else → inspector) and uploads run through
 * the XHR queue with a visible per-file progress panel.
 */
export function MyDriveView() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const addNotification = useNotificationStore(s => s.addNotification);
  const setInspectorOpen = useDriveStore(s => s.setInspectorOpen);
  const setInspectorTab = useDriveStore(s => s.setInspectorTab);
  const {
    currentPath, navigateTo,
    files, loading, error, fetchFiles,
    selectedFile, handleItemClick,
    setSelectedFile,
    view, changeView,
    search, setSearch,
    createFolder,
    renameFile, moveFile, deleteFile,
    handleItemDoubleClick,
    selectedIds, toggleSelection, toggleAll, clearSelection,
    batchDelete, batchMove,
    toggleStar,
  } = useDrive();

  const clipboard = useFileClipboard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [shareUserFiles, setShareUserFiles] = useState<FileRecord[] | null>(null);
  const [shareEmailFile, setShareEmailFile] = useState<FileRecord | null>(null);
  const [tagsFiles, setTagsFiles] = useState<FileRecord[] | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerMode, setFolderPickerMode] = useState<'move' | 'copy'>('move');
  const [folderPickerTargetIds, setFolderPickerTargetIds] = useState<Set<string>>(new Set());
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<Set<string> | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  // D6 viewers
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [textPreviewFile, setTextPreviewFile] = useState<FileRecord | null>(null);

  const anyModalOpen = !!shareFile || !!shareUserFiles || !!shareEmailFile || !!tagsFiles
    || folderPickerOpen || confirmDeleteIds !== null || !!renameTarget || newFolderOpen
    || lightboxIndex !== null || !!textPreviewFile;

  // ─── Upload queue (D6) — XHR with per-file progress ─────

  const {
    items: uploadItems,
    enqueue: enqueueUploads,
    clearFinished: clearFinishedUploads,
  } = useUploadQueue({
    onAllSettled: () => { void fetchFiles(); },
  });

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    enqueueUploads(Array.from(fileList), currentPath);
    e.target.value = '';
  }, [enqueueUploads, currentPath]);

  const handleBatchDownload = useCallback(() => {
    const selected = files.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    if (selected.length === 1) {
      const f = selected[0]!;
      void downloadFile(f.id, f.is_directory ? `${f.filename}.zip` : f.filename);
    } else {
      void downloadBatch([...selectedIds]);
    }
  }, [files, selectedIds]);

  const handleFilesDropped = useCallback((droppedFiles: File[]) => {
    enqueueUploads(droppedFiles, currentPath);
  }, [enqueueUploads, currentPath]);

  const handleNewFolder = useCallback(() => {
    setNewFolderOpen(true);
  }, []);

  // ─── Open dispatcher (D6) ───────────────────────────────

  /** Images of the current folder in display order — the lightbox set. */
  const imageFiles = useMemo(
    () => files.filter(f => !f.is_directory && isImageMime(f.mime_type)),
    [files],
  );

  /** Show the file's details in the right-hand inspector. */
  const openInspector = useCallback((file: FileRecord, tab: 'details' | 'versions' = 'details') => {
    setSelectedFile(file);
    setInspectorTab(tab);
    setInspectorOpen(true);
  }, [setSelectedFile, setInspectorTab, setInspectorOpen]);

  /**
   * Double-click / Enter / context-menu "Open": route the file to its best
   * viewer by mime. Folders keep navigating (via use-drive).
   */
  const openFile = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      handleItemDoubleClick(file);
      return;
    }
    if (isDiagramFile(file)) {
      navigate(`/sketches/${file.id}`);
      return;
    }
    if (isImageMime(file.mime_type)) {
      const idx = imageFiles.findIndex(f => f.id === file.id);
      setLightboxIndex(idx >= 0 ? idx : 0);
      return;
    }
    if (isAudioFile(file) || isVideoFile(file)) {
      void playFromDrive(file);
      return;
    }
    if (isPdfFile(file)) {
      navigate(`/office/pdf/${file.id}`);
      return;
    }
    if (isTextPreviewable(file)) {
      setTextPreviewFile(file);
      return;
    }
    if (isOfficeFile(file)) {
      navigate(`/office/edit/${file.id}`);
      return;
    }
    // No dedicated viewer → inspector details.
    openInspector(file);
  }, [handleItemDoubleClick, navigate, imageFiles, openInspector]);

  // ─── Move / Copy-to via FolderPicker ────────────────────

  const openFolderPicker = useCallback((ids: string[], mode: 'move' | 'copy') => {
    setFolderPickerTargetIds(new Set(ids));
    setFolderPickerMode(mode);
    setFolderPickerOpen(true);
  }, []);

  const handleBatchMove = useCallback(() => {
    openFolderPicker([...selectedIds], 'move');
  }, [selectedIds, openFolderPicker]);

  const handleFolderPickerSelect = useCallback(async (destPath: string) => {
    setFolderPickerOpen(false);
    const ids = [...folderPickerTargetIds];
    if (ids.length === 0) return;
    if (folderPickerMode === 'move') {
      if (ids.length === 1) {
        await moveFile(ids[0]!, destPath);
        addNotification({ type: 'system', title: 'Moved', body: 'File moved successfully' });
      } else {
        await batchMove(new Set(ids), destPath);
        addNotification({ type: 'system', title: 'Moved', body: `${ids.length} items moved` });
      }
    } else {
      // Copy to… → POST /files/:id/copy per id
      try {
        for (const id of ids) {
          await api.post(`/files/${id}/copy`, { dest_parent_folder: destPath });
        }
        toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} copied`);
        await fetchFiles();
      } catch {
        toast.error('Copy failed');
      }
    }
  }, [folderPickerTargetIds, folderPickerMode, moveFile, batchMove, addNotification, fetchFiles]);

  // ─── Delete (single via menu = direct, multi = confirm) ─

  const handleBatchDeleteClick = useCallback(() => {
    setConfirmDeleteIds(new Set(selectedIds));
  }, [selectedIds]);

  const handleConfirmedDelete = useCallback(async () => {
    const ids = confirmDeleteIds;
    setConfirmDeleteIds(null);
    if (!ids || ids.size === 0) return;
    await batchDelete(ids);
    addNotification({ type: 'system', title: 'Deleted', body: `${ids.size} items deleted` });
  }, [confirmDeleteIds, batchDelete, addNotification]);

  // ─── Star (single + bulk) ───────────────────────────────

  const handleToggleStar = useCallback(async (file: FileRecord) => {
    try {
      await toggleStar(file);
      toast.success(file.starred ? 'Star removed' : 'Starred');
    } catch {
      toast.error('Could not update star');
    }
  }, [toggleStar]);

  const handleBulkStar = useCallback(async (targets: FileRecord[], starred: boolean) => {
    const ids = targets.map(f => f.id);
    if (ids.length === 0) return;
    try {
      if (ids.length === 1) {
        await api.patch(`/files/${ids[0]}`, { starred });
      } else {
        await api.post('/files/bulk', { action: starred ? 'star' : 'unstar', ids });
      }
      toast.success(starred
        ? `${ids.length === 1 ? 'Starred' : `${ids.length} items starred`}`
        : `${ids.length === 1 ? 'Star removed' : `${ids.length} stars removed`}`);
      await fetchFiles();
    } catch {
      toast.error('Could not update stars');
    }
  }, [fetchFiles]);

  // ─── Clipboard: cut / copy / paste (D4) ─────────────────

  const handleCut = useCallback((targets: FileRecord[]) => {
    const ids = targets.map(f => f.id);
    if (ids.length === 0) return;
    clipboard.setClipboard('cut', ids, currentPath);
    toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} cut`);
  }, [clipboard, currentPath]);

  const handleCopy = useCallback((targets: FileRecord[]) => {
    const ids = targets.map(f => f.id);
    if (ids.length === 0) return;
    clipboard.setClipboard('copy', ids, currentPath);
    toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} copied`);
  }, [clipboard, currentPath]);

  const handlePaste = useCallback(async (destFolder?: FileRecord) => {
    if (!clipboard.operation || clipboard.fileIds.length === 0) return;
    const dest = destFolder
      ? (destFolder.filepath.endsWith('/') ? destFolder.filepath : destFolder.filepath + '/')
      : currentPath;
    // Don't paste a cut folder into itself
    if (destFolder && clipboard.fileIds.includes(destFolder.id)) {
      toast.error('Cannot paste a folder into itself');
      return;
    }
    const n = clipboard.fileIds.length;
    try {
      if (clipboard.operation === 'cut') {
        await api.post('/files/bulk', { action: 'move', ids: clipboard.fileIds, params: { parent_folder: dest } });
        clipboard.clear();
        toast.success(`${n} item${n === 1 ? '' : 's'} moved`);
      } else {
        for (const id of clipboard.fileIds) {
          await api.post(`/files/${id}/copy`, { dest_parent_folder: dest });
        }
        toast.success(`${n} item${n === 1 ? '' : 's'} pasted`);
      }
      await fetchFiles();
    } catch {
      toast.error('Paste failed');
    }
  }, [clipboard, currentPath, fetchFiles]);

  // ─── Drag-and-drop to folder ────────────────────────────

  const handleDragToFolder = useCallback(async (fileIds: string[], destPath: string) => {
    if (fileIds.length === 1) {
      await moveFile(fileIds[0]!, destPath);
      addNotification({ type: 'system', title: 'Moved', body: 'File moved successfully' });
    } else {
      await batchMove(new Set(fileIds), destPath);
      addNotification({ type: 'system', title: 'Moved', body: `${fileIds.length} items moved` });
    }
  }, [moveFile, batchMove, addNotification]);

  // ─── D4 context menu (builder) ──────────────────────────

  const selectedFiles = useMemo(
    () => files.filter(f => selectedIds.has(f.id)),
    [files, selectedIds],
  );

  const menuCtx: DriveMenuContext = useMemo(() => ({
    tab: 'my-drive',
    clipboard: { operation: clipboard.operation, fileIds: clipboard.fileIds },
    navigate,
    callbacks: {
      // Open → mime dispatcher (D6): lightbox / text viewer / pdf / player / …
      onOpen: openFile,
      // Details/Properties → inspector on the Details tab (D5)
      onPreview: (file) => openInspector(file, 'details'),
      onToggleStar: (targets, starred) => { void handleBulkStar(targets, starred); },
      onShare: (file) => setShareFile(file),
      onShareUser: (targets) => setShareUserFiles(targets),
      onShareEmail: (file) => setShareEmailFile(file),
      onCut: handleCut,
      onCopy: handleCopy,
      onPaste: (destFolder) => { void handlePaste(destFolder); },
      onMoveTo: (targets) => openFolderPicker(targets.map(f => f.id), 'move'),
      onCopyTo: (targets) => openFolderPicker(targets.map(f => f.id), 'copy'),
      onRename: (file) => setRenameTarget(file),
      onTags: (targets) => setTagsFiles(targets),
      // Version history → inspector on the Versions tab (D5). The standalone
      // VersionHistoryDialog stays for views without an inspector.
      onVersions: (file) => openInspector(file, 'versions'),
      // Siempre con ConfirmDialog — también para un único archivo (la
      // versión que borraba directo el single era una regresión de D6)
      onDelete: (targets) => setConfirmDeleteIds(new Set(targets.map(f => f.id))),
      onNewFolder: handleNewFolder,
      onUpload: handleUploadClick,
    },
  }), [
    clipboard.operation, clipboard.fileIds, navigate, openFile, openInspector,
    handleBulkStar, handleCut, handleCopy, handlePaste,
    openFolderPicker, deleteFile, handleNewFolder, handleUploadClick,
  ]);

  /** Right-clicking an item in the selection acts on the whole selection. */
  const getContextMenuItems = useCallback((file: FileRecord) => {
    const targets = selectedIds.has(file.id) && selectedIds.size > 1
      ? selectedFiles
      : [file];
    return buildFileContextMenu(targets, menuCtx);
  }, [selectedIds, selectedFiles, menuCtx]);

  const backgroundItems = useMemo(() => buildBackgroundContextMenu(menuCtx), [menuCtx]);

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
    onPaste: () => { void handlePaste(); },
    onSelectAll: () => {
      if (files.length > 0 && selectedIds.size !== files.length) toggleAll();
    },
    onDelete: () => {
      if (selectedIds.size > 0) setConfirmDeleteIds(new Set(selectedIds));
      else if (selectedFile) void deleteFile(selectedFile.id);
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
      if (target) openFile(target);
    },
    onEscape: () => {
      if (selectedIds.size > 0) clearSelection();
      else if (selectedFile) setSelectedFile(null);
    },
  });

  const hasSelection = selectedIds.size > 0;
  const allSelectedStarred = selectedFiles.length > 0 && selectedFiles.every(f => f.starred);
  const cutIds = useMemo(
    () => (clipboard.operation === 'cut' ? new Set(clipboard.fileIds) : undefined),
    [clipboard.operation, clipboard.fileIds],
  );

  // D5 — the inspector reflects the selection: checked items win, otherwise
  // the clicked (preview) file.
  const inspectorFiles = useMemo(
    () => (selectedFiles.length > 0 ? selectedFiles : selectedFile ? [selectedFile] : []),
    [selectedFiles, selectedFile],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Toolbar */}
      <DriveToolbar
        currentPath={currentPath}
        onNavigate={navigateTo}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={changeView}
        onNewFolder={handleNewFolder}
        onUpload={handleUploadClick}
        isMobile={isMobile}
      />

      {/* Batch action bar */}
      {hasSelection && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 6 : 12,
          padding: isMobile ? '6px 10px' : '8px 16px',
          background: 'var(--amber-dim)',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>
            {selectedIds.size} selected
          </span>

          <div style={{ flex: 1 }} />

          <BatchButton
            icon={allSelectedStarred ? StarOff : Star}
            label={isMobile ? '' : allSelectedStarred ? 'Unstar' : 'Star'}
            onClick={() => { void handleBulkStar(selectedFiles, !allSelectedStarred); }}
          />
          <BatchButton icon={Tags} label={isMobile ? '' : 'Tags'} onClick={() => setTagsFiles(selectedFiles)} />
          <BatchButton icon={UserPlus} label={isMobile ? '' : 'Share'} onClick={() => setShareUserFiles(selectedFiles)} />
          <BatchButton icon={FolderInput} label={isMobile ? '' : 'Move'} onClick={handleBatchMove} />
          <BatchButton icon={Download} label={isMobile ? '' : 'Download'} onClick={handleBatchDownload} />
          <BatchButton icon={Trash2} label={isMobile ? '' : 'Delete'} onClick={handleBatchDeleteClick} variant="danger" />

          <button
            onClick={clearSelection}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
              padding: '4px 8px',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Content area + right inspector (D5). Right-click on the background
          opens New folder / Upload / Paste. */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <DropZone onFilesDropped={handleFilesDropped}>
          <ContextMenu
            trigger={
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {error && (
                  <div style={{
                    padding: '8px 16px', margin: '8px 16px 0', fontSize: 13,
                    color: 'var(--error)', background: 'rgba(239,68,68,0.1)',
                    borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)',
                  }}>
                    {error}
                  </div>
                )}
                {view === 'grid' ? (
                  <DriveGrid
                    files={files}
                    loading={loading}
                    selectedFileId={selectedFile?.id ?? null}
                    selectedIds={selectedIds}
                    hasSelection={hasSelection}
                    onItemClick={handleItemClick}
                    onItemDoubleClick={openFile}
                    onToggleSelect={toggleSelection}
                    getContextMenuItems={getContextMenuItems}
                    onToggleStar={handleToggleStar}
                    onDragToFolder={handleDragToFolder}
                    cutIds={cutIds}
                    isMobile={isMobile}
                    onEmptyUpload={handleUploadClick}
                    onEmptyNewFolder={handleNewFolder}
                  />
                ) : (
                  <DriveList
                    files={files}
                    loading={loading}
                    selectedFileId={selectedFile?.id ?? null}
                    selectedIds={selectedIds}
                    onItemClick={handleItemClick}
                    onItemDoubleClick={openFile}
                    onToggleSelect={toggleSelection}
                    onToggleAll={toggleAll}
                    getContextMenuItems={getContextMenuItems}
                    onToggleStar={handleToggleStar}
                    onDragToFolder={handleDragToFolder}
                    cutIds={cutIds}
                    onEmptyUpload={handleUploadClick}
                    onEmptyNewFolder={handleNewFolder}
                  />
                )}
              </div>
            }
            items={backgroundItems}
          />
        </DropZone>

        {/* Inspector — replaces the old bottom DrivePreview */}
        {inspectorFiles.length > 0 && (
          <DriveInspector
            files={inspectorFiles}
            onClose={() => { clearSelection(); setSelectedFile(null); }}
            onRefetch={() => { void fetchFiles(); }}
            onDeleteFile={(f) => { void deleteFile(f.id); }}
            onToggleStar={(f, starred) => { void handleBulkStar([f], starred); }}
            bulk={{
              onStar: (targets, starred) => { void handleBulkStar(targets, starred); },
              onTags: (targets) => setTagsFiles(targets),
              onMove: (targets) => openFolderPicker(targets.map(f => f.id), 'move'),
              onDelete: (targets) => setConfirmDeleteIds(new Set(targets.map(f => f.id))),
            }}
          />
        )}
      </div>

      {/* Share modal (public link) */}
      {shareFile && (
        <ShareModal
          open={!!shareFile}
          file={shareFile}
          onClose={() => setShareFile(null)}
        />
      )}

      {/* Share with internal user (D4) */}
      <ShareWithUserModal
        open={shareUserFiles !== null}
        files={shareUserFiles ?? []}
        onClose={() => setShareUserFiles(null)}
      />

      {/* Share by email (D4) */}
      {shareEmailFile && (
        <ShareEmailModal
          open={!!shareEmailFile}
          file={shareEmailFile}
          onClose={() => setShareEmailFile(null)}
        />
      )}

      {/* Tags editor (D4) */}
      <TagsModal
        open={tagsFiles !== null}
        files={tagsFiles ?? []}
        onClose={() => setTagsFiles(null)}
        onSaved={() => { void fetchFiles(); }}
      />

      {/* Folder picker for Move / Copy to… */}
      <FolderPicker
        open={folderPickerOpen}
        currentPath={currentPath}
        onSelect={(p) => { void handleFolderPickerSelect(p); }}
        onCancel={() => setFolderPickerOpen(false)}
      />

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDeleteIds !== null}
        onClose={() => setConfirmDeleteIds(null)}
        onConfirm={() => { void handleConfirmedDelete(); }}
        title={`Delete ${confirmDeleteIds?.size ?? 0} item${(confirmDeleteIds?.size ?? 0) === 1 ? '' : 's'}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Rename dialog */}
      <RenameDialog
        open={!!renameTarget}
        currentName={renameTarget?.filename ?? ''}
        title="New name:"
        onConfirm={(name) => {
          if (renameTarget) renameFile(renameTarget.id, name);
        }}
        onClose={() => setRenameTarget(null)}
      />

      {/* New folder dialog */}
      <RenameDialog
        open={newFolderOpen}
        currentName=""
        title="Folder name:"
        confirmLabel="Create"
        onConfirm={(name) => createFolder(name)}
        onClose={() => setNewFolderOpen(false)}
      />

      {/* Image lightbox (D6) — arrows navigate the folder's images */}
      {lightboxIndex !== null && imageFiles.length > 0 && (
        <DriveLightbox
          images={imageFiles}
          currentIndex={Math.min(lightboxIndex, imageFiles.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onToggleStar={(f, starred) => { void handleBulkStar([f], starred); }}
          onDetails={(f) => {
            setLightboxIndex(null);
            openInspector(f, 'details');
          }}
        />
      )}

      {/* Inline text / markdown / code viewer (D6) */}
      <TextPreviewModal
        file={textPreviewFile}
        onClose={() => setTextPreviewFile(null)}
      />

      {/* Upload progress queue (D6) */}
      <UploadQueuePanel items={uploadItems} onClear={clearFinishedUploads} />
    </div>
  );
}

function BatchButton({ icon: Icon, label, onClick, disabled, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
}) {
  const [hovered, setHovered] = useState(false);
  const color = variant === 'danger'
    ? 'var(--error)'
    : 'var(--text)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: hovered && !disabled ? 'var(--surface-hover)' : 'var(--surface)',
        color: disabled ? 'var(--text-muted)' : color,
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
