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

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/services/api';
import type { ApiResponse } from '@/types/api';

export interface ExifData {
  file_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  image: {
    width: number | null;
    height: number | null;
    format: string | null;
    density: number | null;
    orientation: number | null;
    has_alpha: boolean;
    channels: number | null;
    space: string | null;
  };
  exif: Record<string, unknown> | null;
  db_metadata: Record<string, unknown>;
}

export function useExif(fileId: string | null) {
  const [data, setData] = useState<ExifData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get<ApiResponse<ExifData>>(`/files/${fileId}/exif`)
      .then(res => {
        if (!cancelled) setData(res.data);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load EXIF');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fileId]);

  return { data, loading, error };
}
