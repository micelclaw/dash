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
        // Incluir notas que otros usuarios me han compartido (user_shares).
        include_shared: 'true',
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
  useRealtimeList('note', notes, setNotes, fetchNotes);

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
      const msg = err instanceof ApiError ? err.message : 'Failed to create note';
      console.error('createNote failed:', err);
      toast.error(msg);
      throw err;
    }
  };

  const updateNote = async (id: string, input: NoteUpdateInput): Promise<Note> => {
    const res = await api.patch<ApiResponse<Note>>(`/notes/${id}`, input);
    setNotes(prev => prev.map(n => n.id === id ? res.data : n));
    return res.data;
  };

  const deleteNote = async (id: string): Promise<boolean> => {
    const removed = notes.find(n => n.id === id);
    setNotes(prev => prev.filter(n => n.id !== id));

    try {
      if(removed?.sync){
        if(!removed.sync.delete_certified||!removed.sync.local_revision)throw new Error('La papelera de esta conexión aún no está habilitada.');
        const result=await api.delete<ApiResponse<{sync:Note['sync']}>>(`/notes/${id}`,{expected_local_revision:removed.sync.local_revision},{timeout:150000});
        if(result.data.sync?.state==='synced')toast.success('Nota enviada a la papelera de Notion.');
        else if(result.data.sync?.state==='pending')toast.warning('Nota retirada de Micelclaw. La confirmación de Notion sigue pendiente.');
        else toast.error('Notion no confirmó la papelera. La copia local se conserva y el cambio requiere revisión.');
        return true;
      }
      await api.delete(`/notes/${id}`);
      toast('Note moved to trash', {
        action: removed ? {
          label: 'Undo',
          onClick: async () => {
            try {
              const restored = await api.post<ApiResponse<Note>>(`/notes/${id}/restore`);
              setNotes(prev => [restored.data, ...prev]);
            } catch {
              toast.error('Failed to restore note');
            }
          },
        } : undefined,
      });
      return true;
    } catch (err) {
      if (removed) setNotes(prev => [removed, ...prev]);
      toast.error(err instanceof Error ? err.message : 'No se pudo retirar la nota.');
      return false;
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
              const restored = await api.post<ApiResponse<Note>>(`/notes/${id}/unarchive`);
              setNotes(prev => [restored.data, ...prev]);
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
    try {
      if (note.source === 'nextcloud-notes') {
        const detail = (await api.get<ApiResponse<Note>>(`/notes/${id}`)).data;
        if (detail.sync?.provider === 'nextcloud-notes' && detail.sync.favorite_certified) {
          if (detail.sync.state !== 'synced' || !detail.sync.local_revision) {
            toast.warning('Espera a que termine la sincronización antes de cambiar el favorito.');
            return;
          }
          const result = await api.post<ApiResponse<Note>>(`/notes/${id}/sync-edit`, {
            expected_local_revision: detail.sync.local_revision,
            operations: [{ op: 'set_favorite', favorite: !detail.pinned }],
          }, { timeout: 150_000 });
          setNotes(prev => prev.map(n => n.id === id ? result.data : n));
          return;
        }
      }
      const newPinned = !note.pinned;
      setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: newPinned } : n));
      await api.patch(`/notes/${id}`, { pinned: newPinned });
      if (note.source === 'nextcloud-notes') toast.info('Fijada solo en Micelclaw; el favorito de Nextcloud aún no está certificado.');
    } catch {
      setNotes(prev => prev.map(n => n.id === id ? note : n));
      toast.error('Failed to update note');
    }
  };

  // Local-only state update (no API call) — used by NoteEditor to propagate
  // title/tag/content changes back to the sidebar list in real time.
  const patchLocalNote = useCallback((id: string, changes: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...changes } : n));
  }, []);

  return {
    notes, meta, loading, error,
    fetchNotes, createNote, updateNote, deleteNote, archiveNote, togglePin, patchLocalNote,
  };
}
