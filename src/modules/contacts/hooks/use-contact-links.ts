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

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { EntityLink, LinkedRecord } from '@/types/links';
import type { ApiListResponse, ApiResponse } from '@/types/api';

const DOMAIN_MAP: Record<string, { endpoint: string; titleField: string }> = {
  note: { endpoint: '/notes', titleField: 'title' },
  notes: { endpoint: '/notes', titleField: 'title' },
  email: { endpoint: '/emails', titleField: 'subject' },
  emails: { endpoint: '/emails', titleField: 'subject' },
  event: { endpoint: '/events', titleField: 'title' },
  events: { endpoint: '/events', titleField: 'title' },
  contact: { endpoint: '/contacts', titleField: 'display_name' },
  contacts: { endpoint: '/contacts', titleField: 'display_name' },
  file: { endpoint: '/files', titleField: 'filename' },
  files: { endpoint: '/files', titleField: 'filename' },
  diary: { endpoint: '/diary', titleField: 'entry_date' },
  diary_entries: { endpoint: '/diary', titleField: 'entry_date' },
};

const ROUTE_MAP: Record<string, string> = {
  note: '/notes', notes: '/notes',
  event: '/calendar', events: '/calendar',
  contact: '/contacts', contacts: '/contacts',
  email: '/mail', emails: '/mail',
  file: '/drive', files: '/drive',
  diary: '/diary', diary_entries: '/diary',
};

export function useContactLinks(contactId: string | null) {
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion(v => v + 1);
    window.addEventListener('links-changed', handler);
    return () => window.removeEventListener('links-changed', handler);
  }, []);

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
                route: `${ROUTE_MAP[domain] || '/'}?id=${recordId}`,
              },
            });
          } catch {
            records.push({ link, domain, record: { id: recordId, title: recordId, route: `${ROUTE_MAP[domain] || '/'}?id=${recordId}` } });
          }
        }
        setLinkedRecords(records);
      })
      .catch(() => setLinkedRecords([]))
      .finally(() => setLoading(false));
  }, [contactId, version]);

  return { linkedRecords, loading };
}
