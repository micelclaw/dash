import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface EntityLink {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string;
  created_at: string;
}

export interface ResolvedLink extends EntityLink {
  title: string;
  domain: string;
  domainId: string;
}

const TITLE_CACHE = new Map<string, string>();

const DOMAIN_ENDPOINTS: Record<string, { path: string; titleKey: string }> = {
  note: { path: '/notes', titleKey: 'title' },
  event: { path: '/events', titleKey: 'title' },
  contact: { path: '/contacts', titleKey: 'display_name' },
  email: { path: '/emails', titleKey: 'subject' },
  file: { path: '/files', titleKey: 'filename' },
  kanban_card: { path: '/projects/cards', titleKey: 'title' },
};

async function resolveTitle(type: string, id: string): Promise<string> {
  const key = `${type}:${id}`;
  const cached = TITLE_CACHE.get(key);
  if (cached) return cached;

  const config = DOMAIN_ENDPOINTS[type];
  if (!config) {
    const fallback = `${type} ${id.slice(0, 8)}...`;
    TITLE_CACHE.set(key, fallback);
    return fallback;
  }

  try {
    const res = await api.get<{ data: Record<string, unknown> }>(`${config.path}/${id}`);
    const title = String(res.data[config.titleKey] ?? id.slice(0, 8));
    TITLE_CACHE.set(key, title);
    return title;
  } catch {
    const fallback = `${type} ${id.slice(0, 8)}...`;
    TITLE_CACHE.set(key, fallback);
    return fallback;
  }
}

export function useCardLinks(boardId: string, cardId: string | null) {
  const [links, setLinks] = useState<ResolvedLink[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!cardId) { setLinks([]); return; }
    setLoading(true);
    try {
      const res = await api.get<{ data: EntityLink[] }>(`/projects/boards/${boardId}/cards/${cardId}/links`);
      const raw = res.data;

      const resolved = await Promise.all(
        raw.map(async (link) => {
          const isSource = link.source_type === 'kanban_card' && link.source_id === cardId;
          const domain = isSource ? link.target_type : link.source_type;
          const domainId = isSource ? link.target_id : link.source_id;
          const title = await resolveTitle(domain, domainId);
          return { ...link, title, domain, domainId };
        }),
      );
      setLinks(resolved);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [boardId, cardId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const removeLink = useCallback(async (linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
    try {
      await api.delete(`/projects/boards/${boardId}/cards/${cardId}/links/${linkId}`);
    } catch {
      fetchLinks();
    }
  }, [boardId, cardId, fetchLinks]);

  return { links, loading, fetchLinks, removeLink };
}
