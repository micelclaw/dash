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

import { useState, useRef, useCallback } from 'react';
import { FolderInput, Download, Trash2 } from 'lucide-react';
import { DropZone } from '@/components/shared/DropZone';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { RenameDialog } from '@/components/shared/RenameDialog';
import { FolderPicker } from '@/components/shared/FolderPicker';
import { ShareModal } from '@/components/shared/ShareModal';
import { useNotificationStore } from '@/stores/notification.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { downloadFile, downloadBatch } from '@/lib/file-download';
import { useDrive } from './hooks/use-drive';
import { DriveToolbar } from './DriveToolbar';
import { DriveGrid } from './DriveGrid';
import { DriveList } from './DriveList';
import { DrivePreview } from './DrivePreview';
import type { FileRecord } from '@/types/files';

export function Component() {
  const isMobile = useIsMobile();
  const addNotification = useNotificationStore(s => s.addNotification);
  const {
    currentPath, navigateTo,
    files, loading, error,
    selectedFile, handleItemClick,
    setSelectedFile,
    view, changeView,
    search, setSearch,
    uploadFile, createFolder,
    renameFile, moveFile, deleteFile,
    handleItemDoubleClick,
    selectedIds, toggleSelection, toggleAll, clearSelection,
    batchDelete, batchMove,
  } = useDrive();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerTargetIds, setFolderPickerTargetIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f) uploadFile(f);
    }
    e.target.value = '';
  }, [uploadFile]);

  const handleBatchDownload = useCallback(() => {
    const selected = files.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    if (selected.length === 1) {
      const f = selected[0];
      void downloadFile(f.id, f.is_directory ? `${f.filename}.zip` : f.filename);
    } else {
      void downloadBatch([...selectedIds]);
    }
  }, [files, selectedIds]);

  const handleFilesDropped = useCallback((droppedFiles: File[]) => {
    for (const f of droppedFiles) {
      uploadFile(f);
    }
  }, [uploadFile]);

  const handleNewFolder = useCallback(() => {
    setNewFolderOpen(true);
  }, []);

  const handleRename = useCallback((id: string) => {
    const file = files.find(f => f.id === id);
    if (file) setRenameTarget(file);
  }, [files]);

  // Single file move — opens FolderPicker
  const handleMove = useCallback((id: string) => {
    setFolderPickerTargetIds(new Set([id]));
    setFolderPickerOpen(true);
  }, []);

  // Batch move — opens FolderPicker for all selected
  const handleBatchMove = useCallback(() => {
    setFolderPickerTargetIds(new Set(selectedIds));
    setFolderPickerOpen(true);
  }, [selectedIds]);

  // FolderPicker confirmed
  const handleFolderPickerSelect = useCallback(async (destPath: string) => {
    setFolderPickerOpen(false);
    if (folderPickerTargetIds.size === 1) {
      const id = [...folderPickerTargetIds][0]!;
      await moveFile(id, destPath);
      addNotification({ type: 'system', title: 'Moved', body: 'File moved successfully' });
    } else {
      await batchMove(folderPickerTargetIds, destPath);
      addNotification({ type: 'system', title: 'Moved', body: `${folderPickerTargetIds.size} items moved` });
    }
  }, [folderPickerTargetIds, moveFile, batchMove, addNotification]);

  // Batch delete — opens confirm dialog
  const handleBatchDeleteClick = useCallback(() => {
    setConfirmDeleteOpen(true);
  }, []);

  const handleBatchDeleteConfirm = useCallback(async () => {
    const count = selectedIds.size;
    await batchDelete(selectedIds);
    addNotification({ type: 'system', title: 'Deleted', body: `${count} items deleted` });
  }, [selectedIds, batchDelete, addNotification]);

  // Share — opens ShareModal
  const handleShare = useCallback((file: FileRecord) => {
    setShareFile(file);
  }, []);

  // Drag-and-drop to folder
  const handleDragToFolder = useCallback(async (fileIds: string[], destPath: string) => {
    if (fileIds.length === 1) {
      await moveFile(fileIds[0]!, destPath);
      addNotification({ type: 'system', title: 'Moved', body: 'File moved successfully' });
    } else {
      await batchMove(new Set(fileIds), destPath);
      addNotification({ type: 'system', title: 'Moved', body: `${fileIds.length} items moved` });
    }
  }, [moveFile, batchMove, addNotification]);

  const hasSelection = selectedIds.size > 0;

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
        }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>
            {selectedIds.size} selected
          </span>

          <div style={{ flex: 1 }} />

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

      {/* Content area */}
      <DropZone onFilesDropped={handleFilesDropped}>
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
              onItemDoubleClick={handleItemDoubleClick}
              onToggleSelect={toggleSelection}
              onRename={handleRename}
              onMove={handleMove}
              onShare={handleShare}
              onDelete={deleteFile}
              onDragToFolder={handleDragToFolder}
              isMobile={isMobile}
            />
          ) : (
            <DriveList
              files={files}
              loading={loading}
              selectedFileId={selectedFile?.id ?? null}
              selectedIds={selectedIds}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
              onToggleSelect={toggleSelection}
              onToggleAll={toggleAll}
              onRename={handleRename}
              onMove={handleMove}
              onShare={handleShare}
              onDelete={deleteFile}
              onDragToFolder={handleDragToFolder}
            />
          )}
        </div>
      </DropZone>

      {/* Preview panel — fullscreen overlay on mobile, bottom panel on desktop */}
      {selectedFile && (
        <DrivePreview
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={deleteFile}
          isMobile={isMobile}
        />
      )}

      {/* Share modal */}
      {shareFile && (
        <ShareModal
          open={!!shareFile}
          file={shareFile}
          onClose={() => setShareFile(null)}
        />
      )}

      {/* Folder picker for Move */}
      <FolderPicker
        open={folderPickerOpen}
        currentPath={currentPath}
        onSelect={handleFolderPickerSelect}
        onCancel={() => setFolderPickerOpen(false)}
      />

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleBatchDeleteConfirm}
        title={`Delete ${selectedIds.size} items?`}
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
