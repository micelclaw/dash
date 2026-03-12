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

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FileRecord } from '@/types/files';
import type { ApiListResponse } from '@/types/api';

/** Maps virtual source IDs to their basePath prefixes */
const VIRTUAL_PREFIXES: Record<string, string> = {
  gateway: '/gateway/',
  system: '/system/',
};

/**
 * Returns the virtual source ID and sub-path if the given path
 * belongs to a virtual source, or null otherwise.
 */
export function parseVirtualPath(path: string): { sourceId: string; subPath: string } | null {
  for (const [id, prefix] of Object.entries(VIRTUAL_PREFIXES)) {
    if (path.startsWith(prefix)) {
      return { sourceId: id, subPath: path.slice(prefix.length) };
    }
  }
  return null;
}

export function useVirtualSource(sourceId: string | null, subPath: string) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<FileRecord>>('/files/browse', {
        source: sourceId,
        path: subPath || undefined,
      });
      setFiles(res.data);
    } catch {
      setError('Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [sourceId, subPath]);

  useEffect(() => {
    if (sourceId) {
      fetchFiles();
    } else {
      setFiles([]);
    }
  }, [sourceId, fetchFiles]);

  return { files, loading, error, fetchFiles };
}
