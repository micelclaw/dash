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

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import { useFiles } from '@/hooks/use-files';
import { useVirtualSource, parseVirtualPath } from './use-virtual-source';
import { useVFS, type VFSNode } from './use-vfs';
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

/** Check if a path is a VFS mount path (prefixed with /vfs/) */
function isVfsPath(path: string): boolean {
  return path.startsWith('/vfs/');
}

/** Strip the /vfs prefix to get the real VFS path for API calls */
function toVfsApiPath(explorerPath: string): string {
  return explorerPath.slice(4); // remove '/vfs'
}

/** Convert a VFSNode to a FileRecord for compatibility with FileBrowser */
function vfsNodeToFileRecord(node: VFSNode, explorerParentPath: string): FileRecord {
  const explorerPath = '/vfs' + node.path;
  return {
    id: node.path, // VFS nodes don't have UUIDs — use path as ID
    filename: node.name,
    filepath: explorerPath,
    mime_type: node.mime_type || (node.type === 'directory' ? 'inode/directory' : 'application/octet-stream'),
    size_bytes: node.size ?? 0,
    checksum_sha256: null,
    source: 'vfs',
    source_id: null,
    parent_folder: explorerParentPath,
    is_directory: node.type === 'directory',
    metadata: node.metadata ?? null,
    tags: [],
    custom_fields: { provider_type: node.provider_type, is_read_only: node.is_read_only },
    created_at: node.created_at ?? '',
    updated_at: node.modified_at ?? '',
    synced_at: null,
    deleted_at: null,
  };
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

  // Detect path type
  const isVfs = isVfsPath(currentPath);
  const virtualInfo = useMemo(() => isVfs ? null : parseVirtualPath(currentPath), [currentPath, isVfs]);
  const isVirtual = !!virtualInfo;

  // VFS state
  const vfs = useVFS();
  const [vfsFiles, setVfsFiles] = useState<FileRecord[]>([]);
  const [vfsLoading, setVfsLoading] = useState(false);
  const [vfsError, setVfsError] = useState<string | null>(null);

  // Fetch VFS directory contents
  const fetchVfs = useCallback(async (path: string) => {
    setVfsLoading(true);
    setVfsError(null);
    try {
      const apiPath = toVfsApiPath(path);
      const nodes = await vfs.listDirectory(apiPath);
      setVfsFiles(nodes.map(n => vfsNodeToFileRecord(n, path)));
    } catch (err: any) {
      const msg = err?.message || 'Failed to load directory';
      console.error('[VFS] list error:', msg);
      setVfsError(msg);
      setVfsFiles([]);
    } finally {
      setVfsLoading(false);
    }
  }, [vfs.listDirectory]);

  // Fetch VFS mounts so navigateTo can resolve mount names for breadcrumbs
  useEffect(() => { vfs.fetchMounts(); }, [vfs.fetchMounts]);

  // Update currentSource when mounts load and we're already on a VFS path
  useEffect(() => {
    if (isVfs && vfs.mounts.length > 0) {
      const vfsApiPath = toVfsApiPath(currentPath);
      const mount = vfs.mounts.find(m => {
        const mp = m.mount_path.replace(/\/+$/, '');
        return vfsApiPath.startsWith(mp + '/') || vfsApiPath === mp;
      });
      if (mount && !currentSource.id.startsWith('vfs-')) {
        setCurrentSource({
          id: 'vfs-' + mount.id,
          label: mount.name,
          icon: mount.provider_type === 'local' ? HardDrive : Cloud,
          basePath: '/vfs' + (mount.mount_path.startsWith('/') ? mount.mount_path : '/' + mount.mount_path),
          writable: !mount.read_only,
        });
      }
    }
  }, [isVfs, vfs.mounts, currentPath, currentSource.id]);

  useEffect(() => {
    if (isVfs) {
      fetchVfs(currentPath);
    }
  }, [isVfs, currentPath, fetchVfs]);

  // DB files hook (for drive/photos paths)
  const noopParent = isVirtual || isVfs ? '__noop__' : currentPath;
  const dbFiles = useFiles({ parent_folder: noopParent, search: search || undefined });
  const virtualFiles = useVirtualSource(virtualInfo?.sourceId ?? null, virtualInfo?.subPath ?? '');

  // Select the active data source
  const files = isVfs ? vfsFiles : isVirtual ? virtualFiles.files : dbFiles.files;
  const loading = isVfs ? vfsLoading : isVirtual ? virtualFiles.loading : dbFiles.loading;
  const error = isVfs ? vfsError : isVirtual ? virtualFiles.error : dbFiles.error;
  const fetchFiles = isVfs ? (() => fetchVfs(currentPath)) : isVirtual ? virtualFiles.fetchFiles : dbFiles.fetchFiles;
  const { uploadFile, createFolder, renameFile, moveFile, deleteFile } = dbFiles;

  const navigateTo = useCallback((path: string) => {
    if (isVfsPath(path)) {
      // Find the VFS mount that matches this path and create a synthetic SourceRoot
      const vfsApiPath = toVfsApiPath(path);
      const mount = vfs.mounts.find(m => {
        const mp = m.mount_path.replace(/\/+$/, '');
        return vfsApiPath.startsWith(mp + '/') || vfsApiPath === mp;
      });
      if (mount) {
        setCurrentSource({
          id: 'vfs-' + mount.id,
          label: mount.name,
          icon: mount.provider_type === 'local' ? HardDrive : Cloud,
          basePath: '/vfs' + (mount.mount_path.startsWith('/') ? mount.mount_path : '/' + mount.mount_path),
          writable: !mount.read_only,
        });
      }
    } else {
      const source = findSource(path);
      setCurrentSource(source);
    }
    setCurrentPath(path);
    setSelectedFile(null);
    setSelectedIds(new Set());
    setSearch('');
  }, [vfs.mounts]);

  // For VFS paths, check mount read_only status
  const isWritable = useMemo(() => {
    if (isVfs) {
      const vfsApiPath = toVfsApiPath(currentPath);
      const mount = vfs.mounts.find(m => vfsApiPath.startsWith(m.mount_path));
      return mount ? !mount.read_only : false;
    }
    return currentSource.writable ||
      (currentSource.children?.some(c => currentPath.startsWith(c.basePath) && c.writable) ?? false);
  }, [isVfs, currentPath, currentSource, vfs.mounts]);

  const handleItemDoubleClick = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      let targetPath = file.filepath.endsWith('/') ? file.filepath : file.filepath + '/';
      // For virtual sources (gateway/system), filepath is relative
      if (virtualInfo) {
        const prefix = currentPath.slice(0, currentPath.indexOf('/', 1) + 1);
        targetPath = prefix + targetPath.replace(/^\//, '');
      }
      // VFS paths already have /vfs prefix in filepath
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
    if (isVfs) {
      const apiPath = toVfsApiPath(currentPath) + f.name;
      const { api } = await import('@/services/api');
      const formData = new FormData();
      formData.append('file', f);
      await api.upload(`/vfs/write?path=${encodeURIComponent(apiPath)}`, formData);
      fetchVfs(currentPath);
    } else {
      await uploadFile(f, currentPath);
    }
  }, [uploadFile, currentPath, isVfs, fetchVfs]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (isVfs) {
      const apiPath = toVfsApiPath(currentPath) + name;
      await vfs.vfsMkdir(apiPath);
      fetchVfs(currentPath);
    } else {
      await createFolder(name, currentPath);
    }
  }, [createFolder, currentPath, isVfs, vfs.vfsMkdir, fetchVfs]);

  const handleDelete = useCallback(async (id: string) => {
    if (isVfs) {
      await vfs.vfsDelete(id);
      setVfsFiles(prev => prev.filter(f => f.id !== id));
    } else {
      await deleteFile(id);
    }
    setSelectedFile(prev => prev?.id === id ? null : prev);
    setSelectedIds(prev => {
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      return prev;
    });
  }, [deleteFile, isVfs, vfs.vfsDelete]);

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
    if (isVfs) {
      for (const id of ids) {
        await vfs.vfsDelete(id);
      }
      fetchVfs(currentPath);
    } else {
      for (const id of ids) {
        await deleteFile(id);
      }
    }
    setSelectedFile(null);
    setSelectedIds(new Set());
  }, [deleteFile, isVfs, vfs.vfsDelete, fetchVfs, currentPath]);

  const batchMove = useCallback(async (ids: Set<string>, destPath: string) => {
    if (isVfs) {
      for (const id of ids) {
        const fileName = id.split('/').filter(Boolean).pop() ?? 'file';
        const dest = destPath.endsWith('/') ? destPath + fileName : destPath + '/' + fileName;
        await vfs.vfsMove(id, dest);
      }
      fetchVfs(currentPath);
    } else {
      for (const id of ids) {
        await moveFile(id, destPath);
      }
    }
    setSelectedIds(new Set());
  }, [moveFile, isVfs, vfs.vfsMove, fetchVfs, currentPath]);

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
    // VFS-specific
    isVfs,
  };
}
