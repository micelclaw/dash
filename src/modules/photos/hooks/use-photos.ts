import { useState, useCallback, useRef } from 'react';
import { api, ApiError } from '@/services/api';
import type { Photo } from '@/types/files';
import type { ApiListResponse } from '@/types/api';

const PAGE_SIZE = 50;

export function usePhotos(params: { search?: string; minStars?: number | null }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const fetchPhotos = useCallback(async (reset?: boolean) => {
    if (reset) {
      offsetRef.current = 0;
      setPhotos([]);
      setHasMore(true);
    }

    setLoading(true);
    try {
      const res = await api.get<ApiListResponse<Photo>>('/photos/timeline', {
        limit: PAGE_SIZE,
        offset: offsetRef.current,
        search: params.search || undefined,
        min_stars: params.minStars || undefined,
      });

      const incoming = res.data;

      if (reset || offsetRef.current === 0) {
        setPhotos(incoming);
      } else {
        setPhotos(prev => [...prev, ...incoming]);
      }

      offsetRef.current += incoming.length;
      setHasMore(incoming.length >= PAGE_SIZE);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load photos';
      console.error(message);
    } finally {
      setLoading(false);
    }
  }, [params.search, params.minStars]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPhotos(false);
    }
  }, [loading, hasMore, fetchPhotos]);

  return { photos, loading, hasMore, loadMore, fetchPhotos };
}
