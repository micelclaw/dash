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
  kanban_card: { endpoint: '/projects/cards', titleField: 'title' },
  inventory_item: { endpoint: '/inventory/items', titleField: 'name' },
  // Cruce con Facturación: una factura (recibida/emitida) que movió este artículo.
  finance_document: { endpoint: '/finance/documents', titleField: 'number' },
  finance_party: { endpoint: '/finance/parties', titleField: 'name' },
};

const ROUTE_MAP: Record<string, string> = {
  note: '/notes', notes: '/notes',
  event: '/calendar', events: '/calendar',
  contact: '/contacts', contacts: '/contacts',
  email: '/mail', emails: '/mail',
  file: '/drive', files: '/drive',
  diary: '/diary', diary_entries: '/diary',
  kanban_card: '/projects',
};

// Etiqueta legible de la relación cross-dominio (la chip muestra esto de subtítulo).
const RELATIONSHIP_LABEL: Record<string, string> = {
  purchased_item: 'Comprado en esta factura',
  sold_item: 'Vendido en esta factura',
  billed_to: 'Facturado a',
  billed_by: 'Facturado por',
};

function routeFor(domain: string, recordId: string): string {
  // The inventory drawer opens via store, not URL — route to the module only.
  if (domain === 'inventory_item') return '/inventory?tab=catalog';
  // Facturación: deep-link a la factura / ficha del party en la lente.
  if (domain === 'finance_document') return `/finance?tab=facturacion&doc=${recordId}`;
  if (domain === 'finance_party') return `/finance?tab=facturacion&party=${recordId}`;
  return `${ROUTE_MAP[domain] || '/'}?id=${recordId}`;
}

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
      subtitle: RELATIONSHIP_LABEL[link.relationship ?? ''] ?? (link.relationship || link.link_type),
      route: routeFor(domain, recordId),
    },
  };
}

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

        // Show links immediately with fallback titles
        setLinks([...resolved]);
        setLoading(false);

        // Enrich titles in background (parallel), then update
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

async function enrichLinkedRecords(records: LinkedRecord[]): Promise<void> {
  await Promise.allSettled(records.map(async (rec) => {
    const config = DOMAIN_MAP[rec.domain];
    if (!config) return;
    try {
      const res = await api.get<{ data: Record<string, unknown> }>(`${config.endpoint}/${rec.record.id}`);
      const data = res.data;
      rec.record.title = String(data[config.titleField] || 'Unknown');
      rec.record.subtitle = RELATIONSHIP_LABEL[rec.link.relationship ?? ''] ?? String(rec.link.relationship || rec.link.link_type || '');
    } catch {
      // Record may have been deleted — keep the fallback
    }
  }));
}
