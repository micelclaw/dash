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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api';
import type { FileRecord } from '@/types/files';
import type { ApiListResponse } from '@/types/api';

export interface FilesQueryParams {
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  is_directory?: boolean;
  starred?: boolean;
  only_deleted?: boolean;
  search?: string;
  parent_folder?: string;
  /** Bypass the backend semantic cache after read-only flows. */
  no_cache?: boolean;
}

/**
 * Thin GET /files hook for the Drive tab views (Recent / Starred / Trash).
 *
 * Unlike the global `useFiles`, it preserves the SERVER ordering (sort=heat /
 * last_accessed must not be re-sorted client-side) and supports the D1 query
 * params (starred, only_deleted).
 */
export function useFilesQuery(params: FilesQueryParams) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable identity for the params object so callers can pass inline literals.
  const paramsKey = JSON.stringify(params);
  const stableParams = useMemo(() => params, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<FileRecord>>('/files', {
        sort: stableParams.sort,
        order: stableParams.order,
        limit: stableParams.limit ?? 100,
        is_directory: stableParams.is_directory,
        starred: stableParams.starred,
        only_deleted: stableParams.only_deleted,
        search: stableParams.search,
        parent_folder: stableParams.parent_folder,
        no_cache: stableParams.no_cache,
      });
      setFiles(res.data);
    } catch (err) {
      console.error('[useFilesQuery] FETCH ERROR:', err);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [stableParams]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { files, setFiles, loading, error, refetch };
}
