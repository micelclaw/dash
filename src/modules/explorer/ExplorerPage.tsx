import { useEffect, useRef, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FolderTree, X } from 'lucide-react';
import { SplitPane } from '@/components/shared/SplitPane';
import { DropZone } from '@/components/shared/DropZone';
import { useIsMobile } from '@/hooks/use-media-query';
import { SourceTree } from './SourceTree';
import { FileBrowserToolbar } from './FileBrowserToolbar';
import { FileBrowser } from './FileBrowser';
import { FileExplorerPreview } from './FileExplorerPreview';
import { useFileExplorer } from './hooks/use-file-explorer';

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
    deleteFile,
  } = useFileExplorer();

  const isMobile = useIsMobile();
  const [showTree, setShowTree] = useState(false);

  // Read ?path= from URL on mount
  useEffect(() => {
    const pathParam = searchParams.get('path');
    if (pathParam) {
      navigateTo(pathParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            isWritable={isWritable}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onRename={renameFile}
            onDelete={deleteFile}
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
            isWritable={isWritable}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onRename={renameFile}
            onDelete={deleteFile}
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
              <SourceTree currentPath={currentPath} onNavigate={handleMobileNavigate} />
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
      <SourceTree currentPath={currentPath} onNavigate={navigateTo} />
      {contentArea}
    </SplitPane>
  );
}
