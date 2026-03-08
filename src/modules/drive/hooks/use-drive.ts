import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useFiles } from '@/hooks/use-files';
import type { FileRecord } from '@/types/files';
import type { DriveView } from '../types';

/** MIME types that can be opened in specialized editors */
const OPENABLE_MIMES: Record<string, string> = {
  'application/vnd.claw.diagram+json': '/diagrams/',
};

export function useDrive() {
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState('/drive/');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<DriveView>(
    () => (localStorage.getItem('drive-view') as DriveView) || 'grid',
  );
  const [search, setSearch] = useState('');
  const lastToggleRef = useRef<string | null>(null);

  const {
    files, loading, error, fetchFiles,
    uploadFile, createFolder, renameFile, moveFile, deleteFile,
  } = useFiles({
    parent_folder: currentPath,
    search: search || undefined,
  });

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setSelectedIds(new Set());
    setSearch('');
  }, []);

  const navigateUp = useCallback(() => {
    if (currentPath === '/drive/') return;
    const trimmed = currentPath.replace(/\/$/, '');
    const parentIdx = trimmed.lastIndexOf('/');
    if (parentIdx <= 0) {
      setCurrentPath('/drive/');
    } else {
      const parent = trimmed.slice(0, parentIdx + 1);
      if (parent.startsWith('/drive/') || parent === '/drive/') {
        setCurrentPath(parent);
      } else {
        setCurrentPath('/drive/');
      }
    }
    setSelectedFile(null);
    setSelectedIds(new Set());
    setSearch('');
  }, [currentPath]);

  const handleItemDoubleClick = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      navigateTo(file.filepath.endsWith('/') ? file.filepath : file.filepath + '/');
      return;
    }
    // Open in specialized editor if supported
    const editorPath = OPENABLE_MIMES[file.mime_type];
    if (editorPath) {
      navigate(`${editorPath}${file.id}`);
    }
  }, [navigateTo, navigate]);

  const handleItemClick = useCallback((file: FileRecord) => {
    setSelectedFile(prev => prev?.id === file.id ? null : file);
  }, []);

  const changeView = useCallback((v: DriveView) => {
    setView(v);
    localStorage.setItem('drive-view', v);
  }, []);

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

  const handleUpload = useCallback(async (f: File) => {
    await uploadFile(f, currentPath);
  }, [uploadFile, currentPath]);

  const handleRename = useCallback(async (id: string, filename: string) => {
    // Find the old record before rename to know its old filepath
    const oldRecord = files.find(f => f.id === id);
    const updated = await renameFile(id, filename);
    // If a directory was renamed and it's part of the current path, update the path
    if (updated && oldRecord?.isDirectory) {
      const oldPath = oldRecord.filepath.endsWith('/') ? oldRecord.filepath : oldRecord.filepath + '/';
      if (currentPath.startsWith(oldPath) || currentPath === oldPath) {
        const newPath = updated.filepath.endsWith('/') ? updated.filepath : updated.filepath + '/';
        setCurrentPath(currentPath.replace(oldPath, newPath));
      }
    }
  }, [renameFile, currentPath, files]);

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
    navigateTo,
    navigateUp,
    files,
    loading,
    error,
    fetchFiles,
    selectedFile,
    setSelectedFile,
    handleItemClick,
    view,
    changeView,
    search,
    setSearch,
    uploadFile: handleUpload,
    createFolder: handleCreateFolder,
    renameFile: handleRename,
    moveFile,
    deleteFile: handleDelete,
    handleItemDoubleClick,
    // Multi-select
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    batchDelete,
    batchMove,
  };
}
