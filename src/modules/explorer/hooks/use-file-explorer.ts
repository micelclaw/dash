import { useState, useCallback } from 'react';
import { useFiles } from '@/hooks/use-files';
import { SOURCE_ROOTS, type SourceRoot } from '../types';
import type { FileRecord } from '@/types/files';

function findSource(path: string): SourceRoot {
  for (const s of SOURCE_ROOTS) {
    if (s.children) {
      const child = s.children.find(c => path.startsWith(c.basePath));
      if (child) return s;
    }
    // Skip 'system' (basePath '/') unless no other match — it's a catch-all
    if (s.id !== 'system' && path.startsWith(s.basePath)) return s;
  }
  return SOURCE_ROOTS[SOURCE_ROOTS.length - 1]!; // system fallback
}

export function useFileExplorer() {
  const [currentPath, setCurrentPath] = useState('/drive/');
  const [currentSource, setCurrentSource] = useState<SourceRoot>(SOURCE_ROOTS[0]!);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('fexp-view') as 'grid' | 'list') || 'list',
  );
  const [search, setSearch] = useState('');

  const { files, loading, error, fetchFiles, uploadFile, createFolder, renameFile, moveFile, deleteFile } =
    useFiles({ parent_folder: currentPath, search: search || undefined });

  const navigateTo = useCallback((path: string) => {
    const source = findSource(path);
    setCurrentSource(source);
    setCurrentPath(path);
    setSelectedFile(null);
    setSearch('');
  }, []);

  const isWritable = currentSource.writable ||
    (currentSource.children?.some(c => currentPath.startsWith(c.basePath) && c.writable) ?? false);

  const handleItemDoubleClick = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      navigateTo(file.filepath.endsWith('/') ? file.filepath : file.filepath + '/');
    }
  }, [navigateTo]);

  const handleItemClick = useCallback((file: FileRecord) => {
    setSelectedFile(prev => prev?.id === file.id ? null : file);
  }, []);

  const changeView = useCallback((v: 'grid' | 'list') => {
    setView(v);
    localStorage.setItem('fexp-view', v);
  }, []);

  const handleUpload = useCallback(async (f: File) => {
    await uploadFile(f, currentPath);
  }, [uploadFile, currentPath]);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createFolder(name, currentPath);
  }, [createFolder, currentPath]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteFile(id);
    setSelectedFile(prev => prev?.id === id ? null : prev);
  }, [deleteFile]);

  return {
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
    uploadFile: handleUpload,
    createFolder: handleCreateFolder,
    renameFile,
    moveFile,
    deleteFile: handleDelete,
  };
}
