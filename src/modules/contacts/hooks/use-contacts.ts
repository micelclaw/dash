import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/services/api';
import { useRealtimeList } from '@/hooks/use-realtime-list';
import { toast } from 'sonner';
import type { Contact, ContactCreateInput, ContactUpdateInput } from '../types';
import type { ApiListResponse, ApiResponse } from '@/types/api';

interface ContactFilters {
  search?: string;
  tag?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export function useContacts(filters: ContactFilters = {}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<Contact>>('/contacts', {
        search: filters.search || undefined,
        tag: filters.tag || undefined,
        sort: filters.sort ?? 'display_name',
        order: filters.order ?? 'asc',
        limit: filters.limit ?? 100,
        offset: filters.offset ?? 0,
      });
      setContacts(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.tag, filters.sort, filters.order, filters.limit, filters.offset]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useRealtimeList('contact', contacts, setContacts);

  const createContact = async (input: ContactCreateInput): Promise<Contact> => {
    const res = await api.post<ApiResponse<Contact>>('/contacts', input);
    setContacts(prev => [...prev, res.data].sort((a, b) => a.display_name.localeCompare(b.display_name)));
    toast('Contact created');
    return res.data;
  };

  const updateContact = async (id: string, input: ContactUpdateInput): Promise<Contact> => {
    const res = await api.patch<ApiResponse<Contact>>(`/contacts/${id}`, input);
    setContacts(prev => prev.map(c => c.id === id ? res.data : c));
    return res.data;
  };

  const deleteContact = async (id: string): Promise<void> => {
    const removed = contacts.find(c => c.id === id);
    setContacts(prev => prev.filter(c => c.id !== id));
    try {
      await api.delete(`/contacts/${id}`);
      toast('Contact deleted', {
        action: removed ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(`/contacts/${id}/restore`);
              if (removed) setContacts(prev => [...prev, removed].sort((a, b) => a.display_name.localeCompare(b.display_name)));
            } catch { toast.error('Failed to restore contact'); }
          },
        } : undefined,
      });
    } catch {
      if (removed) setContacts(prev => [...prev, removed]);
      toast.error('Failed to delete contact');
    }
  };

  return { contacts, meta, loading, error, fetchContacts, createContact, updateContact, deleteContact };
}
