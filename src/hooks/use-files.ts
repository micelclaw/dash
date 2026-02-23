import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useRealtimeList } from '@/hooks/use-realtime-list';
import type { FileRecord } from '@/types/files';
import type { ApiListResponse, ApiResponse } from '@/types/api';

/** Sort: directories first, then alphabetical */
function fileSorter(a: FileRecord, b: FileRecord): number {
  if (a.is_directory && !b.is_directory) return -1;
  if (!a.is_directory && b.is_directory) return 1;
  return a.filename.localeCompare(b.filename);
}

export function useFiles(params: {
  parent_folder?: string;
  mime_type?: string;
  search?: string;
  tag?: string;
  is_directory?: boolean;
  sort?: string;
  order?: string;
  limit?: number;
}) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<FileRecord>>('/files', {
        parent_folder: params.parent_folder,
        mime_type: params.mime_type,
        search: params.search,
        tag: params.tag,
        is_directory: params.is_directory,
        sort: params.sort ?? 'filename',
        order: params.order ?? 'asc',
        limit: params.limit ?? 100,
      });
      setFiles(res.data.sort(fileSorter));
    } catch {
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [params.parent_folder, params.mime_type, params.search, params.tag, params.is_directory, params.sort, params.order, params.limit]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  useRealtimeList('file', files, setFiles);

  const uploadFile = async (file: File, parentFolder: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parent_folder', parentFolder);
    const res = await api.upload<ApiResponse<FileRecord>>('/files/upload', formData);
    setFiles(prev => [...prev, res.data].sort(fileSorter));
    return res.data;
  };

  const createFolder = async (name: string, parentFolder: string) => {
    const res = await api.post<ApiResponse<FileRecord>>('/files/mkdir', { name, parent_folder: parentFolder });
    setFiles(prev => [...prev, res.data].sort(fileSorter));
    return res.data;
  };

  const renameFile = async (id: string, filename: string) => {
    const res = await api.patch<ApiResponse<FileRecord>>(`/files/${id}`, { filename });
    setFiles(prev => prev.map(f => f.id === id ? res.data : f));
  };

  const moveFile = async (id: string, parentFolder: string) => {
    await api.patch<ApiResponse<FileRecord>>(`/files/${id}`, { parent_folder: parentFolder });
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const deleteFile = async (id: string) => {
    await api.delete(`/files/${id}`);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return { files, loading, error, fetchFiles, uploadFile, createFolder, renameFile, moveFile, deleteFile };
}
