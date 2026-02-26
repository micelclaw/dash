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

  const createAlbum = async (name: string, description?: string): Promise<Album> => {
    const res = await api.post<ApiResponse<Album>>('/albums', { name, description });
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

  const addPhotosToAlbum = async (albumId: string, fileIds: string[]) => {
    await api.post(`/albums/${albumId}/photos`, { file_ids: fileIds });
    setAlbums(prev => prev.map(a => a.id === albumId
      ? { ...a, photo_count: a.photo_count + fileIds.length } : a));
    toast(`${fileIds.length} photo${fileIds.length !== 1 ? 's' : ''} added`);
  };

  const removePhotoFromAlbum = async (albumId: string, fileId: string) => {
    await api.delete(`/albums/${albumId}/photos/${fileId}`);
    setAlbums(prev => prev.map(a => a.id === albumId
      ? { ...a, photo_count: Math.max(0, a.photo_count - 1) } : a));
    toast('Photo removed from album');
  };

  const setAlbumCover = async (albumId: string, photoId: string) => {
    await api.patch(`/albums/${albumId}`, { cover_photo_id: photoId, cover_mode: 'custom' });
    setAlbums(prev => prev.map(a => a.id === albumId
      ? { ...a, cover_photo_id: photoId, cover_mode: 'custom' as const } : a));
    toast('Cover updated');
  };

  const updateAlbum = async (albumId: string, data: { name?: string; description?: string }) => {
    const res = await api.patch<ApiResponse<Album>>(`/albums/${albumId}`, data);
    setAlbums(prev => prev.map(a => a.id === albumId ? res.data : a));
    toast('Album updated');
  };

  return {
    albums,
    loading,
    fetchAlbums,
    createAlbum,
    deleteAlbum,
    addPhotosToAlbum,
    removePhotoFromAlbum,
    setAlbumCover,
    updateAlbum,
  };
}
