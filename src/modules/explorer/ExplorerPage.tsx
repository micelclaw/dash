import { useEffect, useRef, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FolderTree, X, Trash2, Download, Move } from 'lucide-react';
import { toast } from 'sonner';
import { SplitPane } from '@/components/shared/SplitPane';
import { DropZone } from '@/components/shared/DropZone';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useIsMobile } from '@/hooks/use-media-query';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { downloadFile, downloadBatch } from '@/lib/file-download';
import { SourceTree } from './SourceTree';
import { FileBrowserToolbar } from './FileBrowserToolbar';
import { FileBrowser } from './FileBrowser';
import { FileExplorerPreview } from './FileExplorerPreview';
import { MountWizard } from './MountWizard';
import { useFileExplorer } from './hooks/use-file-explorer';
import { api } from '@/services/api';

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
  } = useFileExplorer();

  const isMobile = useIsMobile();
  const [showTree, setShowTree] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [mountWizardOpen, setMountWizardOpen] = useState(false);
  const [mountRefreshKey, setMountRefreshKey] = useState(0);
  const clipboard = useFileClipboard();

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
            clipboard.setClipboard('copy', ids, currentPath);
            toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} copied`);
          }
        } else if (e.key === 'x' && isWritable) {
          e.preventDefault();
          const ids = selectedIds.size > 0 ? [...selectedIds] : selectedFile ? [selectedFile.id] : [];
          if (ids.length > 0) {
            clipboard.setClipboard('cut', ids, currentPath);
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
        setConfirmBatchDelete(true);
      }

      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, selectedFile, currentPath, isWritable, clipboard, toggleAll, clearSelection]);

  const handlePaste = useCallback(async () => {
    if (!clipboard.operation || clipboard.fileIds.length === 0) return;

    try {
      if (clipboard.operation === 'cut') {
        // Move files
        for (const id of clipboard.fileIds) {
          await moveFile(id, currentPath);
        }
        toast.success(`${clipboard.fileIds.length} item${clipboard.fileIds.length > 1 ? 's' : ''} moved`);
      } else {
        // Copy files
        for (const id of clipboard.fileIds) {
          await api.post(`/files/${id}/copy`, { dest_parent_folder: currentPath });
        }
        toast.success(`${clipboard.fileIds.length} item${clipboard.fileIds.length > 1 ? 's' : ''} copied`);
      }
      clipboard.clear();
    } catch {
      toast.error('Paste operation failed');
    }
  }, [clipboard, currentPath, moveFile]);

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
            currentPath={currentPath}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleAll}
            onRename={renameFile}
            onDelete={deleteFile}
            onPaste={handlePaste}
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
            currentPath={currentPath}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleAll}
            onRename={renameFile}
            onDelete={deleteFile}
            onPaste={handlePaste}
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
            <BatchButton icon={Trash2} label="Delete" onClick={() => setConfirmBatchDelete(true)} variant="danger" />
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

      {/* Batch delete confirmation */}
      <ConfirmDialog
        open={confirmBatchDelete}
        title={`Delete ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}?`}
        description="This action will move the selected items to trash."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          void batchDelete(selectedIds);
          setConfirmBatchDelete(false);
        }}
        onClose={() => setConfirmBatchDelete(false)}
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
