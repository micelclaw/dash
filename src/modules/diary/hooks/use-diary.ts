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
import type { DiaryEntry, DiaryCreateInput } from '../types';
import type { ApiListResponse, ApiResponse } from '@/types/api';

interface DiaryFilters {
  search?: string;
  from?: string;
  to?: string;
  mood?: string;
}

export function useDiary(filters: DiaryFilters = {}) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<DiaryEntry>>('/diary', {
        sort: 'entry_date',
        order: 'desc',
        limit: 100,
        search: filters.search || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        mood: filters.mood || undefined,
      });
      setEntries(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load diary');
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.from, filters.to, filters.mood]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useRealtimeList('diary', entries, setEntries);

  const createEntry = async (input: DiaryCreateInput): Promise<DiaryEntry> => {
    const res = await api.post<ApiResponse<DiaryEntry>>('/diary', {
      ...input,
      content: input.content || '',
    });
    setEntries(prev => [res.data, ...prev]);
    return res.data;
  };

  const updateEntry = async (id: string, input: Partial<DiaryEntry>): Promise<DiaryEntry> => {
    const res = await api.patch<ApiResponse<DiaryEntry>>(`/diary/${id}`, input);
    setEntries(prev => prev.map(e => e.id === id ? res.data : e));
    return res.data;
  };

  const deleteEntry = async (id: string): Promise<void> => {
    const removed = entries.find(e => e.id === id);
    setEntries(prev => prev.filter(e => e.id !== id));
    try {
      await api.delete(`/diary/${id}`);
      toast('Entry deleted', {
        action: removed ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(`/diary/${id}/restore`);
              if (removed) setEntries(prev => [removed, ...prev]);
            } catch { toast.error('Failed to restore entry'); }
          },
        } : undefined,
      });
    } catch {
      if (removed) setEntries(prev => [removed, ...prev]);
      toast.error('Failed to delete entry');
    }
  };

  /** Create or navigate to today's entry */
  const openToday = async (): Promise<DiaryEntry> => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await api.get<ApiResponse<DiaryEntry>>(`/diary/date/${today}`);
      return res.data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return createEntry({ entry_date: today, content: '' });
      }
      throw err;
    }
  };

  return { entries, loading, error, fetchEntries, createEntry, updateEntry, deleteEntry, openToday };
}
