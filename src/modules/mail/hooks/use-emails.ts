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
import type { Email, EmailFilters } from '../types';
import type { ApiListResponse } from '@/types/api';

export function useEmails(filters: EmailFilters = {}) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Translate virtual folder names to actual API params
      let folder: string | undefined = filters.folder || undefined;
      let is_starred: boolean | undefined = filters.is_starred;
      let only_deleted = false;

      if (folder === 'STARRED') {
        folder = undefined;
        is_starred = true;
      } else if (folder === 'TRASH') {
        // Show both: emails in TRASH folder (IMAP) AND soft-deleted emails
        only_deleted = true;
      } else if (folder === 'ARCHIVE') {
        folder = 'Archive';
      }

      const res = await api.get<ApiListResponse<Email>>('/emails', {
        limit: filters.limit ?? 50,
        offset: filters.offset ?? 0,
        sort: 'received_at',
        order: 'desc',
        folder,
        account_id: filters.account_id || undefined,
        search: filters.search || undefined,
        is_read: filters.is_read,
        is_starred,
        has_attachments: filters.has_attachments,
        label: filters.label || undefined,
        status: filters.status || undefined,
        thread_id: filters.thread_id || undefined,
        only_deleted: only_deleted || undefined,
      });
      setEmails(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [
    filters.limit, filters.offset, filters.folder, filters.account_id,
    filters.search, filters.is_read, filters.is_starred, filters.has_attachments,
    filters.label, filters.status, filters.thread_id,
  ]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  useRealtimeList('email', emails, setEmails);

  const markRead = async (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, is_read: true } : e));
    try {
      await api.post(`/emails/${id}/read`);
    } catch {
      setEmails(prev => prev.map(e => e.id === id ? { ...e, is_read: false } : e));
    }
  };

  const markUnread = async (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, is_read: false } : e));
    try {
      await api.post(`/emails/${id}/unread`);
    } catch {
      setEmails(prev => prev.map(e => e.id === id ? { ...e, is_read: true } : e));
    }
  };

  const toggleStar = async (id: string) => {
    const email = emails.find(e => e.id === id);
    if (!email) return;
    const newVal = !email.is_starred;
    setEmails(prev => prev.map(e => e.id === id ? { ...e, is_starred: newVal } : e));
    try {
      await api.post(`/emails/${id}/${newVal ? 'star' : 'unstar'}`);
    } catch {
      setEmails(prev => prev.map(e => e.id === id ? { ...e, is_starred: !newVal } : e));
    }
  };

  const archiveEmail = async (id: string) => {
    const removed = emails.find(e => e.id === id);
    const previousFolder = removed?.folder ?? 'INBOX';
    setEmails(prev => prev.filter(e => e.id !== id));
    try {
      await api.patch(`/emails/${id}`, { folder: 'Archive' });
      toast('Archived', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.patch(`/emails/${id}`, { folder: previousFolder });
              if (removed) setEmails(prev => [removed, ...prev]);
            } catch { toast.error('Failed to undo'); }
          },
        },
      });
    } catch {
      if (removed) setEmails(prev => [removed, ...prev]);
      toast.error('Failed to archive');
    }
  };

  const moveToFolder = async (id: string, folder: string) => {
    await api.patch(`/emails/${id}`, { folder });
    fetchEmails();
  };

  const deleteEmail = async (id: string) => {
    const removed = emails.find(e => e.id === id);
    setEmails(prev => prev.filter(e => e.id !== id));
    try {
      await api.delete(`/emails/${id}`);
      toast('Deleted', {
        action: removed ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(`/emails/${id}/restore`);
              if (removed) setEmails(prev => [removed, ...prev]);
            } catch { toast.error('Failed to restore'); }
          },
        } : undefined,
      });
    } catch {
      if (removed) setEmails(prev => [removed, ...prev]);
      toast.error('Failed to delete');
    }
  };

  const snoozeEmail = async (id: string, until: string) => {
    const removed = emails.find(e => e.id === id);
    setEmails(prev => prev.filter(e => e.id !== id));
    try {
      await api.post(`/emails/${id}/snooze`, { until });
      toast(`Snoozed until ${new Date(until).toLocaleDateString()}`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(`/emails/${id}/unsnooze`);
              if (removed) setEmails(prev => [removed, ...prev]);
            } catch { toast.error('Failed to undo'); }
          },
        },
      });
    } catch {
      if (removed) setEmails(prev => [removed, ...prev]);
      toast.error('Failed to snooze');
    }
  };

  const restoreEmail = async (id: string) => {
    const removed = emails.find(e => e.id === id);
    setEmails(prev => prev.filter(e => e.id !== id));
    try {
      await api.post(`/emails/${id}/restore`);
      toast.success('Email restored to Inbox');
    } catch {
      if (removed) setEmails(prev => [removed, ...prev]);
      toast.error('Failed to restore');
    }
  };

  const sendEmail = async (data: Record<string, unknown>) => {
    const res = await api.post<{ data: Email }>('/emails/send', data);
    return res.data;
  };

  const batchAction = async (ids: string[], action: string, params?: Record<string, string>) => {
    await api.post('/emails/batch', { ids: Array.from(ids), action, params });
    fetchEmails();
  };

  return {
    emails, meta, loading, error, fetchEmails,
    markRead, markUnread, toggleStar,
    archiveEmail, moveToFolder, deleteEmail, restoreEmail,
    snoozeEmail, sendEmail, batchAction,
  };
}
