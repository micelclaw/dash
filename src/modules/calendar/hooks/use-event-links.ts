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
import type { ApiListResponse } from '@/types/api';
import { resolveLink, enrichLinkedRecords } from '@/config/related-links';

export function useEventLinks(eventId: string | null) {
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion(v => v + 1);
    window.addEventListener('links-changed', handler);
    return () => window.removeEventListener('links-changed', handler);
  }, []);

  useEffect(() => {
    if (!eventId) { setLinkedRecords([]); return; }

    let cancelled = false;
    setLoading(true);
    api.get<ApiListResponse<EntityLink>>('/links', { entity_type: 'event', entity_id: eventId })
      .then(async (res) => {
        if (cancelled) return;
        const resolved = res.data
          .map(link => resolveLink(link, eventId))
          .filter(r => r.domain !== 'graph_entity');
        setLinkedRecords([...resolved]);
        setLoading(false);
        await enrichLinkedRecords(resolved);
        if (!cancelled) setLinkedRecords([...resolved]);
      })
      .catch(() => { if (!cancelled) { setLinkedRecords([]); setLoading(false); } });

    return () => { cancelled = true; };
  }, [eventId, version]);

  return { linkedRecords, loading };
}
