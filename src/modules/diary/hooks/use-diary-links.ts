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

export function useDiaryLinks(entryId: string | null) {
  const [links, setLinks] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion(v => v + 1);
    window.addEventListener('links-changed', handler);
    return () => window.removeEventListener('links-changed', handler);
  }, []);

  useEffect(() => {
    if (!entryId) { setLinks([]); return; }

    let cancelled = false;
    setLoading(true);

    api.get<ApiListResponse<EntityLink>>('/links', {
      entity_type: 'diary_entry',
      entity_id: entryId,
      limit: 20,
    })
      .then(async (res) => {
        if (cancelled) return;
        const resolved = res.data
          .map(link => resolveLink(link, entryId))
          .filter(r => r.domain !== 'graph_entity');

        setLinks([...resolved]);
        setLoading(false);

        await enrichLinkedRecords(resolved);
        if (!cancelled) setLinks([...resolved]);
      })
      .catch(() => { if (!cancelled) { setLinks([]); setLoading(false); } });

    return () => { cancelled = true; };
  }, [entryId, version]);

  return { links, loading };
}
