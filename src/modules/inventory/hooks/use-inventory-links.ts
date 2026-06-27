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
import { api } from '@/services/api';
import type { EntityLink, LinkedRecord } from '@/types/links';
import type { ApiListResponse } from '@/types/api';
import { resolveLink, enrichLinkedRecords } from '@/config/related-links';

export function useInventoryLinks(itemId: string | null) {
  const [links, setLinks] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  // Re-fetch when a link is created/deleted anywhere
  useEffect(() => {
    const handler = () => setVersion(v => v + 1);
    window.addEventListener('links-changed', handler);
    return () => window.removeEventListener('links-changed', handler);
  }, []);

  useEffect(() => {
    if (!itemId) { setLinks([]); return; }

    let cancelled = false;
    setLoading(true);

    api.get<ApiListResponse<EntityLink>>('/links', {
      entity_type: 'inventory_item',
      entity_id: itemId,
      limit: 20,
    })
      .then(async (res) => {
        if (cancelled) return;
        const resolved = res.data
          .map(link => resolveLink(link, itemId))
          // Filter out graph_entity links (shown in GraphProximityPanel)
          .filter(r => r.domain !== 'graph_entity');

        setLinks([...resolved]);
        setLoading(false);

        await enrichLinkedRecords(resolved);
        if (!cancelled) setLinks([...resolved]);
      })
      .catch(() => { if (!cancelled) { setLinks([]); setLoading(false); } });

    return () => { cancelled = true; };
  }, [itemId, version]);

  /** Manual re-fetch (e.g. right after creating a link from the drawer). */
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  return { links, loading, refresh };
}
