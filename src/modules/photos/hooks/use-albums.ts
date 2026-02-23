import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/services/api';
import { toast } from 'sonner';
import type { Album } from '@/types/files';
import type { ApiListResponse, ApiResponse } from '@/types/api';

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiListResponse<Album>>('/albums', {
        sort: 'created_at',
        order: 'desc',
      });
      setAlbums(res.data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load albums';
      console.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  const createAlbum = async (name: string): Promise<Album> => {
    const res = await api.post<ApiResponse<Album>>('/albums', { name });
    setAlbums(prev => [res.data, ...prev]);
    toast('Album created');
    return res.data;
  };

  const deleteAlbum = async (id: string): Promise<void> => {
    const removed = albums.find(a => a.id === id);
    setAlbums(prev => prev.filter(a => a.id !== id));
    try {
      await api.delete(`/albums/${id}`);
      toast('Album deleted');
    } catch {
      if (removed) setAlbums(prev => [removed, ...prev]);
      toast.error('Failed to delete album');
    }
  };

  return { albums, loading, createAlbum, deleteAlbum };
}
