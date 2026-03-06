import { useState, useCallback, useRef } from 'react';
import { api, ApiError } from '@/services/api';
import type { Photo } from '@/types/files';
import type { ApiListResponse } from '@/types/api';

const PAGE_SIZE = 50;

export function usePhotos(params: { search?: string; selectedStars?: Set<number> }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const fetchIdRef = useRef(0); // guard against concurrent fetches

  const fetchPhotos = useCallback(async (reset?: boolean) => {
    const id = ++fetchIdRef.current; // invalidate any in-flight request

    if (reset) {
      offsetRef.current = 0;
      setPhotos([]);
      setHasMore(true);
    }

    setLoading(true);
    try {
      const starsParam = params.selectedStars && params.selectedStars.size > 0
        ? [...params.selectedStars].join(',')
        : undefined;

      const res = await api.get<ApiListResponse<Photo>>('/photos/timeline', {
        limit: PAGE_SIZE,
        offset: offsetRef.current,
        search: params.search || undefined,
        stars: starsParam,
      });

      // If a newer fetch was started while we were awaiting, discard this result
      if (id !== fetchIdRef.current) return;

      const incoming = res.data;

      if (reset || offsetRef.current === 0) {
        setPhotos(incoming);
      } else {
        setPhotos(prev => [...prev, ...incoming]);
      }

      offsetRef.current += incoming.length;
      setHasMore(incoming.length >= PAGE_SIZE);
    } catch (err) {
      if (id !== fetchIdRef.current) return;
      const message = err instanceof ApiError ? err.message : 'Failed to load photos';
      console.error(message);
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, [params.search, params.selectedStars]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPhotos(false);
    }
  }, [loading, hasMore, fetchPhotos]);

  return { photos, loading, hasMore, loadMore, fetchPhotos };
}
