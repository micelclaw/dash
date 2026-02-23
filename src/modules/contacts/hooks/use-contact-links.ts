import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { EntityLink, LinkedRecord } from '@/types/links';
import type { ApiListResponse, ApiResponse } from '@/types/api';

const DOMAIN_MAP: Record<string, { endpoint: string; titleField: string }> = {
  note: { endpoint: '/notes', titleField: 'title' },
  email: { endpoint: '/emails', titleField: 'subject' },
  event: { endpoint: '/events', titleField: 'title' },
  contact: { endpoint: '/contacts', titleField: 'display_name' },
  file: { endpoint: '/files', titleField: 'filename' },
  diary: { endpoint: '/diary', titleField: 'entry_date' },
};

export function useContactLinks(contactId: string | null) {
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contactId) { setLinkedRecords([]); return; }

    setLoading(true);
    api.get<ApiListResponse<EntityLink>>('/links', { entity_type: 'contact', entity_id: contactId })
      .then(async (res) => {
        const records: LinkedRecord[] = [];
        for (const link of res.data) {
          const isSource = link.source_id === contactId;
          const domain = isSource ? link.target_type : link.source_type;
          const recordId = isSource ? link.target_id : link.source_id;
          const config = DOMAIN_MAP[domain];
          if (!config) continue;
          try {
            const rec = await api.get<ApiResponse<Record<string, unknown>>>(`${config.endpoint}/${recordId}`);
            records.push({
              link,
              domain,
              record: {
                id: recordId,
                title: String(rec.data?.[config.titleField] || recordId),
                route: `/${domain}s?id=${recordId}`,
              },
            });
          } catch {
            records.push({ link, domain, record: { id: recordId, title: recordId, route: `/${domain}s?id=${recordId}` } });
          }
        }
        setLinkedRecords(records);
      })
      .catch(() => setLinkedRecords([]))
      .finally(() => setLoading(false));
  }, [contactId]);

  return { linkedRecords, loading };
}
