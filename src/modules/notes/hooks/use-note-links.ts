import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { EntityLink, LinkedRecord } from '@/types/links';
import type { ApiListResponse } from '@/types/api';

const ROUTE_MAP: Record<string, string> = {
  note: '/notes',
  event: '/calendar',
  contact: '/contacts',
  email: '/mail',
  file: '/drive',
  diary: '/diary',
};

function resolveLink(link: EntityLink, currentId: string): LinkedRecord {
  const isSource = link.source_id === currentId;
  const domain = isSource ? link.target_type : link.source_type;
  const recordId = isSource ? link.target_id : link.source_id;

  return {
    link,
    domain,
    record: {
      id: recordId,
      title: `${domain} record`,
      subtitle: link.link_type,
      route: `${ROUTE_MAP[domain] || '/'}?id=${recordId}`,
    },
  };
}

export function useNoteLinks(noteId: string | null) {
  const [links, setLinks] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!noteId) { setLinks([]); return; }

    let cancelled = false;
    setLoading(true);

    api.get<ApiListResponse<EntityLink>>('/links', {
      entity_type: 'note',
      entity_id: noteId,
      limit: 20,
    })
      .then(async (res) => {
        if (cancelled) return;
        const resolved = res.data.map(link => resolveLink(link, noteId));
        // Enrich titles by fetching each linked record
        await enrichLinkedRecords(resolved);
        if (!cancelled) setLinks(resolved);
      })
      .catch(() => { if (!cancelled) setLinks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [noteId]);

  return { links, loading };
}

const FIELDS_BY_DOMAIN: Record<string, string> = {
  note: 'title',
  event: 'title,start_at',
  contact: 'display_name',
  email: 'subject,from_name',
  file: 'filename',
  diary: 'entry_date,mood',
};

async function enrichLinkedRecords(records: LinkedRecord[]): Promise<void> {
  for (const rec of records) {
    try {
      const endpoint = rec.domain === 'diary' ? 'diary' : `${rec.domain}s`;
      const fields = FIELDS_BY_DOMAIN[rec.domain] || 'id';
      const res = await api.get<{ data: Record<string, unknown> }>(`/${endpoint}/${rec.record.id}`, { fields });
      const data = res.data;
      rec.record.title = String(
        data.title || data.display_name || data.subject || data.filename || data.entry_date || 'Unknown',
      );
      rec.record.subtitle = String(
        data.start_at || data.from_name || data.mood || rec.link.link_type || '',
      );
    } catch {
      // Record may have been deleted — keep the fallback
    }
  }
}
