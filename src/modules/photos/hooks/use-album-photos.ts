import { useState, useCallback, useRef, useEffect } from 'react';
import { api, ApiError } from '@/services/api';
import type { Photo } from '@/types/files';

const PAGE_SIZE = 50;

export function useAlbumPhotos(albumId: string | null) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

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
        { limit: PAGE_SIZE, offset: offsetRef.current },
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
  }, [albumId]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPhotos(false);
  }, [loading, hasMore, fetchPhotos]);

  // Reset when album changes
  useEffect(() => {
    if (albumId) {
      fetchPhotos(true);
    } else {
      setPhotos([]);
    }
  }, [albumId, fetchPhotos]);

  return { photos, loading, hasMore, loadMore, fetchPhotos };
}
