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

// Los TRES bloques colapsables de inteligencia de relaciones — Related Entities +
// Similar Semantic + Graph Proximity — para CUALQUIER registro de CUALQUIER dominio.
// Reúne lo que notes/contacts/etc. montan por separado en un único componente
// reutilizable, para que kanban, inventario, clientes y movimientos tengan la misma
// estructura. El panel Related lleva el botón de enlazar (sourceType/sourceId).

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { EntityLink, LinkedRecord } from '@/types/links';
import type { ApiListResponse } from '@/types/api';
import { resolveLink, enrichLinkedRecords } from '@/config/related-links';
import { RelatedItemsPanel } from './RelatedItemsPanel';
import { SimilarContentPanel } from './SimilarContentPanel';
import { GraphProximityPanel } from './GraphProximityPanel';

/** Hook genérico de enlaces (entity_links) de un registro — mismo comportamiento que
 *  use-note-links/use-contact-links/… pero parametrizado por entityType. */
export function useRelatedLinks(entityType: string, entityId: string | null) {
  const [links, setLinks] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion(v => v + 1);
    window.addEventListener('links-changed', handler);
    return () => window.removeEventListener('links-changed', handler);
  }, []);

  useEffect(() => {
    if (!entityId) { setLinks([]); return; }
    let cancelled = false;
    setLoading(true);
    api.get<ApiListResponse<EntityLink>>('/links', { entity_type: entityType, entity_id: entityId, limit: 20 })
      .then(async (res) => {
        if (cancelled) return;
        const resolved = res.data.map(l => resolveLink(l, entityId)).filter(r => r.domain !== 'graph_entity');
        setLinks([...resolved]);
        setLoading(false);
        await enrichLinkedRecords(resolved);
        if (!cancelled) setLinks([...resolved]);
      })
      .catch(() => { if (!cancelled) { setLinks([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [entityType, entityId, version]);

  return { links, loading };
}

export function RelationIntelligence({ sourceType, sourceId, onNavigate }: { sourceType: string; sourceId: string | null; onNavigate?: () => void }) {
  const { links, loading } = useRelatedLinks(sourceType, sourceId);
  if (!sourceId) return null;
  // Un único <div> (no Fragment) para que los 3 paneles NO hereden el `gap` del
  // contenedor flex padre (kanban/inventory) y se apilen con su propio padding.
  // `margin: 0 -16px` cancela el padding horizontal (16px) del IntelligencePanelHeader
  // → el contenido alinea con los labels del contenedor (sin tabulación), sea cual
  // sea el padding del contenedor (≥16). borderTop = separación visual.
  return (
    <div style={{ margin: '0 -16px', borderTop: '1px solid var(--border)', paddingTop: 4 }}>
      <RelatedItemsPanel links={links} loading={loading} onNavigate={onNavigate} sourceType={sourceType} sourceId={sourceId} />
      <SimilarContentPanel sourceType={sourceType} sourceId={sourceId} />
      <GraphProximityPanel sourceType={sourceType} sourceId={sourceId} />
    </div>
  );
}
