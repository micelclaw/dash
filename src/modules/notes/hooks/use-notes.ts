import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/services/api';
import { useRealtimeList } from '@/hooks/use-realtime-list';
import { toast } from 'sonner';
import type { Note, NoteCreateInput, NoteUpdateInput, NoteFilters } from '@/types/notes';
import type { ApiListResponse, ApiResponse } from '@/types/api';

export function useNotes(filters: NoteFilters) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<Note>>('/notes', {
        limit: filters.limit ?? 50,
        offset: filters.offset ?? 0,
        sort: filters.sort ?? 'updated_at',
        order: filters.order ?? 'desc',
        search: filters.search || undefined,
        tag: filters.tag || undefined,
        source: filters.source || undefined,
        pinned: filters.pinned,
        archived: filters.archived ?? false,
      });
      setNotes(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [filters.limit, filters.offset, filters.sort, filters.order, filters.search, filters.tag, filters.source, filters.pinned, filters.archived]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Real-time WS updates
  useRealtimeList('note', notes, setNotes);

  const createNote = async (input: NoteCreateInput): Promise<Note> => {
    const tempId = `temp-${Date.now()}`;
    const tempNote: Note = {
      id: tempId,
      title: input.title || null,
      content: input.content,
      content_format: input.content_format || 'html',
      source: 'local',
      source_id: null,
      tags: input.tags || [],
      pinned: input.pinned || false,
      archived: false,
      custom_fields: input.custom_fields || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced_at: null,
      deleted_at: null,
    };

    setNotes(prev => [tempNote, ...prev]);

    try {
      const res = await api.post<ApiResponse<Note>>('/notes', {
        ...input,
        content_format: input.content_format || 'html',
      });
      setNotes(prev => prev.map(n => n.id === tempId ? res.data : n));
      return res.data;
    } catch (err) {
      setNotes(prev => prev.filter(n => n.id !== tempId));
      toast.error('Failed to create note');
      throw err;
    }
  };

  const updateNote = async (id: string, input: NoteUpdateInput): Promise<Note> => {
    const res = await api.patch<ApiResponse<Note>>(`/notes/${id}`, input);
    setNotes(prev => prev.map(n => n.id === id ? res.data : n));
    return res.data;
  };

  const deleteNote = async (id: string): Promise<void> => {
    const removed = notes.find(n => n.id === id);
    setNotes(prev => prev.filter(n => n.id !== id));

    try {
      await api.delete(`/notes/${id}`);
      toast('Note moved to trash', {
        action: removed ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(`/notes/${id}/restore`);
              if (removed) setNotes(prev => [removed, ...prev]);
            } catch {
              toast.error('Failed to restore note');
            }
          },
        } : undefined,
      });
    } catch {
      if (removed) setNotes(prev => [removed, ...prev]);
      toast.error('Failed to delete note');
    }
  };

  const archiveNote = async (id: string): Promise<void> => {
    const removed = notes.find(n => n.id === id);
    setNotes(prev => prev.filter(n => n.id !== id));

    try {
      await api.post(`/notes/${id}/archive`);
      toast('Note archived', {
        action: removed ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(`/notes/${id}/unarchive`);
              if (removed) setNotes(prev => [removed, ...prev]);
            } catch {
              toast.error('Failed to unarchive note');
            }
          },
        } : undefined,
      });
    } catch {
      if (removed) setNotes(prev => [removed, ...prev]);
      toast.error('Failed to archive note');
    }
  };

  const togglePin = async (id: string): Promise<void> => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const newPinned = !note.pinned;
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: newPinned } : n));
    try {
      await api.patch(`/notes/${id}`, { pinned: newPinned });
    } catch {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !newPinned } : n));
      toast.error('Failed to update note');
    }
  };

  return {
    notes, meta, loading, error,
    fetchNotes, createNote, updateNote, deleteNote, archiveNote, togglePin,
  };
}
