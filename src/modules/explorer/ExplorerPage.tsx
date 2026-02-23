import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { SplitPane } from '@/components/shared/SplitPane';
import { DropZone } from '@/components/shared/DropZone';
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

      {/* Preview panel */}
      {selectedFile && !selectedFile.is_directory && (
        <FileExplorerPreview
          file={selectedFile}
          isWritable={isWritable}
          onClose={() => setSelectedFile(null)}
          onDelete={deleteFile}
        />
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
