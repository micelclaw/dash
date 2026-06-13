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

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { FolderTree, X, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SplitPane } from '@/components/shared/SplitPane';
import { DropZone } from '@/components/shared/DropZone';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { RenameDialog } from '@/components/shared/RenameDialog';
import { useIsMobile } from '@/hooks/use-media-query';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { downloadFile, downloadBatch, downloadVfsFile } from '@/lib/file-download';
import { SourceTree } from './SourceTree';
import { FileBrowserToolbar } from './FileBrowserToolbar';
import { FileBrowser } from './FileBrowser';
import { FileExplorerPreview } from './FileExplorerPreview';
import { MountWizard } from './MountWizard';
import { CrossSourcePicker } from './CrossSourcePicker';
import { useFileExplorer, toVfsApiPath } from './hooks/use-file-explorer';
import type { ExplorerMenuContext } from './context-menu';
import { api } from '@/services/api';
import type { FileRecord } from '@/types/files';

export function Component() {
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    currentPath,
    currentSource,
    navigateTo,
    files,
    loading,
    error,
    fetchFiles,
    selectedFile,
    setSelectedFile,
    handleItemClick,
    handleItemDoubleClick,
    view,
    changeView,
    search,
    setSearch,
    isWritable,
    uploadFile,
    createFolder,
    renameFile,
    moveFile,
    deleteFile,
    // Multi-select
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    batchDelete,
    batchMove,
    batchCopy,
    isVfs,
  } = useFileExplorer();

  const isMobile = useIsMobile();
  const [showTree, setShowTree] = useState(false);
  /** Delete confirmation target ids (from batch bar, Del key or context menu). */
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [mountWizardOpen, setMountWizardOpen] = useState(false);
  const [mountRefreshKey, setMountRefreshKey] = useState(0);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  /** CrossSourcePicker state for Move to… / Copy to… (VFS paths). */
  const [picker, setPicker] = useState<{ action: 'copy' | 'move'; ids: string[] } | null>(null);
  const clipboard = useFileClipboard();

  /** Which clipboard namespace the current location belongs to. */
  const currentSpace: 'index' | 'vfs' = isVfs ? 'vfs' : 'index';

  // Read ?path= from URL on mount
  useEffect(() => {
    const pathParam = searchParams.get('path');
    if (pathParam) {
      navigateTo(pathParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: Ctrl+C, Ctrl+X, Ctrl+V, Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          const ids = selectedIds.size > 0 ? [...selectedIds] : selectedFile ? [selectedFile.id] : [];
          if (ids.length > 0) {
            clipboard.setClipboard('copy', ids, currentPath, currentSpace);
            toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} copied`);
          }
        } else if (e.key === 'x' && isWritable) {
          e.preventDefault();
          const ids = selectedIds.size > 0 ? [...selectedIds] : selectedFile ? [selectedFile.id] : [];
          if (ids.length > 0) {
            clipboard.setClipboard('cut', ids, currentPath, currentSpace);
            toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} cut`);
          }
        } else if (e.key === 'v' && isWritable && clipboard.operation && clipboard.fileIds.length > 0) {
          e.preventDefault();
          handlePaste();
        } else if (e.key === 'a') {
          e.preventDefault();
          toggleAll();
        }
      }

      if (e.key === 'Delete' && isWritable && selectedIds.size > 0) {
        e.preventDefault();
        setPendingDeleteIds([...selectedIds]);
      }

      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, selectedFile, currentPath, currentSpace, isWritable, clipboard, toggleAll, clearSelection]);

  /**
   * Paste the clipboard into `destFolder` (context menu over a folder) or the
   * current folder. VFS ids are PATHS → POST /vfs/move | /vfs/copy. Index ids
   * are UUIDs → moveFile / POST /files/:id/copy. Never mix the two spaces.
   */
  const handlePaste = useCallback(async (destFolder?: FileRecord) => {
    const op = clipboard.operation;
    if (!op || clipboard.fileIds.length === 0) return;
    if (clipboard.space !== currentSpace) {
      toast.error(clipboard.space === 'index'
        ? 'Clipboard items are from Drive — paste them there'
        : 'Clipboard items are File Explorer paths — paste them in a storage source');
      return;
    }
    if (destFolder && clipboard.fileIds.includes(destFolder.id)) {
      toast.error('Cannot paste a folder into itself');
      return;
    }

    const n = clipboard.fileIds.length;
    try {
      if (currentSpace === 'vfs') {
        const destDir = (destFolder ? destFolder.id : toVfsApiPath(currentPath)).replace(/\/+$/, '');
        for (const from of clipboard.fileIds) {
          const name = from.split('/').filter(Boolean).pop() ?? 'file';
          const to = `${destDir}/${name}`;
          if (to === from) continue; // cut+paste into the same folder → no-op
          if (op === 'cut') await api.post('/vfs/move', { from, to });
          else await api.post('/vfs/copy', { from, to });
        }
      } else {
        const destPath = destFolder
          ? (destFolder.filepath.endsWith('/') ? destFolder.filepath : destFolder.filepath + '/')
          : currentPath;
        if (op === 'cut') {
          for (const id of clipboard.fileIds) await moveFile(id, destPath);
        } else {
          for (const id of clipboard.fileIds) await api.post(`/files/${id}/copy`, { dest_parent_folder: destPath });
        }
      }
      if (op === 'cut') clipboard.clear();
      toast.success(`${n} item${n > 1 ? 's' : ''} ${op === 'cut' ? 'moved' : 'pasted'}`);
      await fetchFiles();
    } catch {
      toast.error('Paste operation failed');
    }
  }, [clipboard, currentPath, currentSpace, moveFile, fetchFiles]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      Array.from(fileList).forEach(f => uploadFile(f));
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [uploadFile]);

  const handleFilesDropped = useCallback((droppedFiles: File[]) => {
    droppedFiles.forEach(f => uploadFile(f));
  }, [uploadFile]);

  // On mobile, close the tree drawer after navigating
  const handleMobileNavigate = useCallback((path: string) => {
    navigateTo(path);
    if (isMobile) setShowTree(false);
  }, [navigateTo, isMobile]);

  /**
   * Download one-or-many entries. VFS entries stream via GET /vfs/read?download=1
   * (their id IS the VFS path — never /files/<path>/download); index entries keep
   * the /files/:id/download + batch-zip flow.
   */
  const handleDownload = useCallback((targets: FileRecord[]) => {
    if (targets.length === 0) return;
    if (isVfs) {
      const filesOnly = targets.filter(f => !f.is_directory);
      if (filesOnly.length < targets.length) {
        toast.info('Folders can’t be downloaded from this source');
      }
      filesOnly.forEach(f => { void downloadVfsFile(f.id, f.filename); });
    } else if (targets.length === 1) {
      const f = targets[0]!;
      void downloadFile(f.id, f.is_directory ? `${f.filename}.zip` : f.filename);
    } else {
      void downloadBatch(targets.map(f => f.id));
    }
  }, [isVfs]);

  const handleBatchDownload = useCallback(() => {
    handleDownload(files.filter(f => selectedIds.has(f.id)));
  }, [files, selectedIds, handleDownload]);

  // ─── Context-menu handlers ─────────────────────────────

  const handleCut = useCallback((targets: FileRecord[]) => {
    if (targets.length === 0) return;
    clipboard.setClipboard('cut', targets.map(f => f.id), currentPath, currentSpace);
    toast.success(`${targets.length} item${targets.length > 1 ? 's' : ''} cut`);
  }, [clipboard, currentPath, currentSpace]);

  const handleCopy = useCallback((targets: FileRecord[]) => {
    if (targets.length === 0) return;
    clipboard.setClipboard('copy', targets.map(f => f.id), currentPath, currentSpace);
    toast.success(`${targets.length} item${targets.length > 1 ? 's' : ''} copied`);
  }, [clipboard, currentPath, currentSpace]);

  const handlePickerConfirm = useCallback(async (destPath: string) => {
    if (!picker) return;
    const { action, ids } = picker;
    setPicker(null);
    try {
      if (action === 'move') await batchMove(new Set(ids), destPath);
      else await batchCopy(new Set(ids), destPath);
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} ${action === 'move' ? 'moved' : 'copied'}`);
    } catch {
      toast.error(`${action === 'move' ? 'Move' : 'Copy'} failed`);
    }
  }, [picker, batchMove, batchCopy]);

  const confirmPendingDelete = useCallback(async () => {
    const ids = pendingDeleteIds ?? [];
    setPendingDeleteIds(null);
    if (ids.length === 0) return;
    try {
      if (ids.length === 1) await deleteFile(ids[0]!);
      else await batchDelete(new Set(ids));
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} deleted`);
    } catch {
      toast.error('Delete failed');
    }
  }, [pendingDeleteIds, deleteFile, batchDelete]);

  /** Menu context shared by row menus + background menu (FileBrowser injects onRename). */
  const menuCtx: ExplorerMenuContext = useMemo(() => ({
    writable: isWritable,
    space: currentSpace,
    clipboard: { operation: clipboard.operation, fileIds: clipboard.fileIds, space: clipboard.space },
    callbacks: {
      onOpen: (file) => { if (file.is_directory) handleItemDoubleClick(file); else setSelectedFile(file); },
      onProperties: (file) => setSelectedFile(file),
      onDownload: handleDownload,
      onCut: handleCut,
      onCopy: handleCopy,
      onPaste: (destFolder) => { void handlePaste(destFolder); },
      // Move to… / Copy to… browse VFS mounts — only meaningful for VFS entries
      ...(isVfs ? {
        onMoveTo: (targets: FileRecord[]) => setPicker({ action: 'move', ids: targets.map(f => f.id) }),
        onCopyTo: (targets: FileRecord[]) => setPicker({ action: 'copy', ids: targets.map(f => f.id) }),
      } : {}),
      onDelete: (targets) => setPendingDeleteIds(targets.map(f => f.id)),
      onNewFolder: () => setNewFolderOpen(true),
      onUpload: handleUploadClick,
    },
  }), [
    isWritable, currentSpace, clipboard.operation, clipboard.fileIds, clipboard.space, isVfs,
    handleItemDoubleClick, setSelectedFile, handleDownload, handleCut, handleCopy, handlePaste, handleUploadClick,
  ]);

  const fileBrowserBlock = (
    <>
      {isWritable ? (
        <DropZone onFilesDropped={handleFilesDropped}>
          <FileBrowser
            files={files}
            loading={loading}
            error={error}
            view={view}
            selectedFile={selectedFile}
            selectedIds={selectedIds}
            isWritable={isWritable}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleAll}
            onRename={renameFile}
            menuCtx={menuCtx}
          />
        </DropZone>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <FileBrowser
            files={files}
            loading={loading}
            error={error}
            view={view}
            selectedFile={selectedFile}
            selectedIds={selectedIds}
            isWritable={isWritable}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleAll}
            onRename={renameFile}
            menuCtx={menuCtx}
          />
        </div>
      )}
    </>
  );

  const contentArea = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <FileBrowserToolbar
        currentPath={currentPath}
        currentSource={currentSource}
        isWritable={isWritable}
        view={view}
        search={search}
        onNavigate={navigateTo}
        onViewChange={changeView}
        onSearchChange={setSearch}
        onCreateFolder={createFolder}
        onUploadClick={handleUploadClick}
      />

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            background: 'var(--amber-dim)',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {selectedIds.size} selected
          </span>
          <div style={{ flex: 1 }} />
          <BatchButton icon={Download} label="Download" onClick={handleBatchDownload} />
          {isWritable && (
            <BatchButton icon={Trash2} label="Delete" onClick={() => setPendingDeleteIds([...selectedIds])} variant="danger" />
          )}
          <BatchButton icon={X} label="Clear" onClick={clearSelection} />
        </div>
      )}

      {/* File content area */}
      {fileBrowserBlock}

      {/* Preview panel — desktop: inline; mobile: fullscreen overlay */}
      {selectedFile && !selectedFile.is_directory && (
        isMobile ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 900,
              background: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedFile.filename}
              </span>
              <button
                onClick={() => setSelectedFile(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <FileExplorerPreview
                file={selectedFile}
                isWritable={isWritable}
                onClose={() => setSelectedFile(null)}
                onDelete={deleteFile}
              />
            </div>
          </div>
        ) : (
          <FileExplorerPreview
            file={selectedFile}
            isWritable={isWritable}
            onClose={() => setSelectedFile(null)}
            onDelete={deleteFile}
          />
        )
      )}

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Delete confirmation (batch bar, Del key, context menu) */}
      <ConfirmDialog
        open={pendingDeleteIds !== null}
        title={`Delete ${pendingDeleteIds?.length ?? 0} item${(pendingDeleteIds?.length ?? 0) > 1 ? 's' : ''}?`}
        description={currentSpace === 'vfs'
          ? 'This will permanently delete the selected items from the storage source.'
          : 'This action will move the selected items to trash.'}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { void confirmPendingDelete(); }}
        onClose={() => setPendingDeleteIds(null)}
      />

      {/* New folder (background context menu) */}
      <RenameDialog
        open={newFolderOpen}
        currentName=""
        title="New folder name:"
        confirmLabel="Create"
        onConfirm={(name) => {
          void Promise.resolve(createFolder(name)).catch(() => toast.error('Failed to create folder'));
        }}
        onClose={() => setNewFolderOpen(false)}
      />

      {/* Move to… / Copy to… across storage sources */}
      <CrossSourcePicker
        open={picker !== null}
        action={picker?.action ?? 'copy'}
        sourcePaths={picker?.ids ?? []}
        onConfirm={(dest) => { void handlePickerConfirm(dest); }}
        onCancel={() => setPicker(null)}
      />

      {/* Mount wizard */}
      <MountWizard
        open={mountWizardOpen}
        onClose={() => setMountWizardOpen(false)}
        onCreated={() => { setMountWizardOpen(false); setMountRefreshKey(k => k + 1); }}
      />
    </div>
  );

  /* ── Mobile layout ─────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        {/* Toggle button for SourceTree drawer */}
        <button
          onClick={() => setShowTree(prev => !prev)}
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 810,
            background: 'var(--bg-elevated, var(--bg))',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius, 6px)',
            padding: '6px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--text)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.08))',
          }}
        >
          <FolderTree size={14} />
        </button>

        {/* SourceTree drawer overlay */}
        {showTree && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowTree(false)}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 799,
                background: 'rgba(0,0,0,0.35)',
              }}
            />
            {/* Drawer panel */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '75%',
                maxWidth: 300,
                zIndex: 800,
                background: 'var(--bg)',
                borderRight: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg, 0 4px 24px rgba(0,0,0,.15))',
                overflow: 'auto',
              }}
            >
              <SourceTree currentPath={currentPath} onNavigate={handleMobileNavigate} onAddSource={() => setMountWizardOpen(true)} refreshKey={mountRefreshKey} />
            </div>
          </>
        )}

        {/* Main content — full width on mobile */}
        {contentArea}
      </div>
    );
  }

  /* ── Desktop layout (unchanged) ────────────────────────────── */
  return (
    <SplitPane
      defaultSizes={[20, 80]}
      minSizes={[180, 400]}
      id="explorer-split"
    >
      <SourceTree currentPath={currentPath} onNavigate={navigateTo} onAddSource={() => setMountWizardOpen(true)} refreshKey={mountRefreshKey} />
      {contentArea}
    </SplitPane>
  );
}

/* ── Batch action button ── */

function BatchButton({ icon: Icon, label, onClick, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: variant === 'danger' ? 'var(--error)' : 'var(--text)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
