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

import { type OriginEntity } from '@/types/origins';
import { useState, useCallback } from 'react';
import { api } from '@/services/api';

export interface VFSNode extends OriginEntity {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number | null;
  mime_type: string | null;
  modified_at: string | null;
  created_at: string | null;
  is_read_only: boolean;
  provider_type: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VFSMount extends OriginEntity {
  id: string;
  name: string;
  provider_type: string;
  mount_path: string;
  status: string;
  read_only: boolean;
  cache_policy: string;
  last_accessed: string | null;
  created_at: string;
}

export function useVFS() {
  const [mounts, setMounts] = useState<VFSMount[]>([]);
  const [mountsLoading, setMountsLoading] = useState(true);

  const fetchMounts = useCallback(async () => {
    setMountsLoading(true);
    try {
      const res = await api.get<{ data: VFSMount[] }>('/vfs/mounts');
      // El mount home del usuario (/user/files) se muestra como "HOME" (estilo
      // Synology). Renombrado SOLO de display; el mount_path/rootPath no cambian.
      setMounts(res.data.map((m) => (m.name === 'Files' ? { ...m, name: 'HOME' } : m)));
    } catch { /* ignore */ }
    finally { setMountsLoading(false); }
  }, []);

  const listDirectory = useCallback(async (path: string): Promise<VFSNode[]> => {
    const res = await api.get<{ data: VFSNode[] }>('/vfs/list', { path });
    return res.data;
  }, []);

  const vfsMkdir = useCallback(async (path: string) => {
    await api.post(`/vfs/mkdir?path=${encodeURIComponent(path)}`);
  }, []);

  const vfsDelete = useCallback(async (path: string) => {
    await api.delete(`/vfs/delete?path=${encodeURIComponent(path)}`);
  }, []);

  const vfsMove = useCallback(async (from: string, to: string) => {
    await api.post('/vfs/move', { from, to });
  }, []);

  const vfsCopy = useCallback(async (from: string, to: string) => {
    await api.post('/vfs/copy', { from, to });
  }, []);

  const createMount = useCallback(async (data: {
    name: string;
    provider_type: string;
    mount_path: string;
    config?: Record<string, unknown>;
    read_only?: boolean;
  }) => {
    await api.post('/vfs/mounts', data);
    await fetchMounts();
  }, [fetchMounts]);

  const deleteMount = useCallback(async (id: string) => {
    await api.delete(`/vfs/mounts/${id}`);
    await fetchMounts();
  }, [fetchMounts]);

  return {
    mounts,
    mountsLoading,
    fetchMounts,
    listDirectory,
    vfsMkdir,
    vfsDelete,
    vfsMove,
    vfsCopy,
    createMount,
    deleteMount,
  };
}
