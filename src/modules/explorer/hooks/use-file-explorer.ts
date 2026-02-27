import { useState, useCallback, useRef, useMemo } from 'react';
import { useFiles } from '@/hooks/use-files';
import { useVirtualSource, parseVirtualPath } from './use-virtual-source';
import { SOURCE_ROOTS, type SourceRoot } from '../types';
import type { FileRecord } from '@/types/files';

function findSource(path: string): SourceRoot {
  for (const s of SOURCE_ROOTS) {
    if (s.children) {
      const child = s.children.find(c => path.startsWith(c.basePath));
      if (child) return s;
    }
    if (path.startsWith(s.basePath)) return s;
  }
  return SOURCE_ROOTS[0]!; // drive fallback
}

export function useFileExplorer() {
  const [currentPath, setCurrentPath] = useState('/drive/');
  const [currentSource, setCurrentSource] = useState<SourceRoot>(SOURCE_ROOTS[0]!);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastToggleRef = useRef<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('fexp-view') as 'grid' | 'list') || 'list',
  );
  const [search, setSearch] = useState('');

  // Detect if current path is a virtual source
  const virtualInfo = useMemo(() => parseVirtualPath(currentPath), [currentPath]);
  const isVirtual = !!virtualInfo;

  // Both hooks are always called (rules of hooks), but only one is "active"
  const dbFiles = useFiles({ parent_folder: isVirtual ? '__noop__' : currentPath, search: search || undefined });
  const virtualFiles = useVirtualSource(virtualInfo?.sourceId ?? null, virtualInfo?.subPath ?? '');

  // Select the active data source
  const files = isVirtual ? virtualFiles.files : dbFiles.files;
  const loading = isVirtual ? virtualFiles.loading : dbFiles.loading;
  const error = isVirtual ? virtualFiles.error : dbFiles.error;
  const fetchFiles = isVirtual ? virtualFiles.fetchFiles : dbFiles.fetchFiles;
  const { uploadFile, createFolder, renameFile, moveFile, deleteFile } = dbFiles;

  const navigateTo = useCallback((path: string) => {
    const source = findSource(path);
    setCurrentSource(source);
    setCurrentPath(path);
    setSelectedFile(null);
    setSelectedIds(new Set());
    setSearch('');
  }, []);

  const isWritable = currentSource.writable ||
    (currentSource.children?.some(c => currentPath.startsWith(c.basePath) && c.writable) ?? false);

  const handleItemDoubleClick = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      let targetPath = file.filepath.endsWith('/') ? file.filepath : file.filepath + '/';
      // For virtual sources, filepath is relative to the physical root.
      // Prepend the virtual prefix so navigateTo resolves correctly.
      if (virtualInfo) {
        const prefix = currentPath.slice(0, currentPath.indexOf('/', 1) + 1); // e.g. '/gateway/'
        targetPath = prefix + targetPath.replace(/^\//, '');
      }
      navigateTo(targetPath);
    }
  }, [navigateTo, virtualInfo, currentPath]);

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
    setSelectedIds(prev => {
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      return prev;
    });
  }, [deleteFile]);

  // Multi-select
  const toggleSelection = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastToggleRef.current) {
        const fromIdx = files.findIndex(f => f.id === lastToggleRef.current);
        const toIdx = files.findIndex(f => f.id === id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const start = Math.min(fromIdx, toIdx);
          const end = Math.max(fromIdx, toIdx);
          for (let i = start; i <= end; i++) {
            next.add(files[i]!.id);
          }
        }
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      lastToggleRef.current = id;
      return next;
    });
  }, [files]);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === files.length && files.length > 0) {
        return new Set();
      }
      return new Set(files.map(f => f.id));
    });
  }, [files]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const batchDelete = useCallback(async (ids: Set<string>) => {
    for (const id of ids) {
      await deleteFile(id);
    }
    setSelectedFile(null);
    setSelectedIds(new Set());
  }, [deleteFile]);

  const batchMove = useCallback(async (ids: Set<string>, destPath: string) => {
    for (const id of ids) {
      await moveFile(id, destPath);
    }
    setSelectedIds(new Set());
  }, [moveFile]);

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
    // Multi-select
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    batchDelete,
    batchMove,
  };
}
