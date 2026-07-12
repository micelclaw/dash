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

import { useState, useCallback, useRef, useEffect } from 'react';
import { api, ApiError } from '@/services/api';
import type { Photo } from '@/types/files';
import type { PhotoSortField, PhotoSortDir } from '../types';

const PAGE_SIZE = 50;

export function useAlbumPhotos(
  albumId: string | null,
  opts?: { sortField?: PhotoSortField; sortDir?: PhotoSortDir; selectedStars?: Set<number> },
) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const sortField = opts?.sortField ?? 'date';
  const sortDir = opts?.sortDir ?? 'desc';
  const starsParam = opts?.selectedStars && opts.selectedStars.size > 0
    ? [...opts.selectedStars].join(',')
    : undefined;

  const fetchPhotos = useCallback(async (reset?: boolean) => {
    if (!albumId) return;

    if (reset) {
      offsetRef.current = 0;
      setPhotos([]);
      setHasMore(true);
    }

    setLoading(true);
    try {
      const res = await api.get<{ data: Photo[]; meta: { total: number } }>(
        `/albums/${albumId}/photos`,
        { limit: PAGE_SIZE, offset: offsetRef.current, sort: sortField, order: sortDir, stars: starsParam },
      );

      const incoming = res.data;

      if (reset || offsetRef.current === 0) {
        setPhotos(incoming);
      } else {
        setPhotos(prev => [...prev, ...incoming]);
      }

      offsetRef.current += incoming.length;
      setHasMore(incoming.length >= PAGE_SIZE);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load album photos';
      console.error(message);
    } finally {
      setLoading(false);
    }
  }, [albumId, sortField, sortDir, starsParam]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPhotos(false);
  }, [loading, hasMore, fetchPhotos]);

  // Reset when album (or sort/filter) changes — fetchPhotos identity carries them.
  useEffect(() => {
    if (albumId) {
      fetchPhotos(true);
    } else {
      setPhotos([]);
    }
  }, [albumId, fetchPhotos]);

  const removePhotos = useCallback((ids: Set<string>) => {
    setPhotos(prev => prev.filter(p => !ids.has(p.id)));
  }, []);

  return { photos, loading, hasMore, loadMore, fetchPhotos, removePhotos };
}
