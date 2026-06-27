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

// Picker UNIVERSAL para relacionar el registro actual con CUALQUIER otra entidad de
// cualquier dominio. Busca vía GET /search y crea/borra el enlace vía POST/DELETE
// /links (tabla genérica entity_links). Lo abre el botón de enlace del header de
// "Related Entities" (RelatedItemsPanel) en todos los módulos.

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Link as LinkIcon, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { resolveEntity } from '@/config/entity-registry';
import type { SearchResult } from '@/types/search';
import type { EntityLink } from '@/types/links';
import type { ApiListResponse } from '@/types/api';

const TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'note', label: 'Notas' },
  { id: 'event', label: 'Eventos' },
  { id: 'contact', label: 'Contactos' },
  { id: 'email', label: 'Emails' },
  { id: 'diary', label: 'Diario' },
  { id: 'file', label: 'Archivos' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'finance_document', label: 'Facturas' },
  { id: 'finance_journal_entry', label: 'Movimientos' },
];

// El dominio que devuelve /search → el slug que acepta entity_links/validTypes.
const toLinkType = (domain: string): string => (domain === 'inventory' ? 'inventory_item' : domain);

function resultTitle(r: SearchResult): string {
  const rec = (r.record ?? {}) as Record<string, unknown>;
  const v = (k: string) => (typeof rec[k] === 'string' && (rec[k] as string).trim() ? (rec[k] as string).trim() : '');
  return v('title') || v('name') || v('display_name') || v('subject') || v('filename') || v('number') || v('description') || (r.snippet?.slice(0, 60)) || r.domain;
}

export function RelateEntityModal({ sourceType, sourceId, onClose }: { sourceType: string; sourceId: string; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [linkIdMap, setLinkIdMap] = useState<Map<string, string>>(new Map());

  // Enlaces actuales del registro → marcar lo ya relacionado.
  useEffect(() => {
    api.get<ApiListResponse<EntityLink>>('/links', { entity_type: sourceType, entity_id: sourceId, limit: 100 })
      .then((res) => {
        const ids = new Set<string>(); const map = new Map<string, string>();
        for (const l of res.data) {
          const otherId = l.source_id === sourceId ? l.target_id : l.source_id;
          ids.add(otherId); map.set(otherId, l.id);
        }
        setLinkedIds(ids); setLinkIdMap(map);
      })
      .catch(() => {});
  }, [sourceType, sourceId]);

  // Búsqueda con debounce.
  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { q: search.trim(), limit: '20' };
        if (tab !== 'all') params.domains = tab === 'inventory' ? 'inventory' : tab;
        const res = await api.get<{ data: SearchResult[] }>('/search', params);
        // No ofrecer el propio registro como destino.
        setResults((res.data ?? []).filter(r => r.record_id !== sourceId));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, tab, sourceId]);

  const toggle = useCallback(async (r: SearchResult) => {
    const id = r.record_id;
    if (linkedIds.has(id)) {
      const linkId = linkIdMap.get(id);
      if (!linkId) return;
      try {
        await api.delete(`/links/${linkId}`);
        setLinkedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        setLinkIdMap(prev => { const n = new Map(prev); n.delete(id); return n; });
        window.dispatchEvent(new CustomEvent('links-changed'));
      } catch { toast.error('No se pudo quitar la relación'); }
    } else {
      try {
        const res = await api.post<{ data: { id: string } }>('/links', {
          source_type: sourceType, source_id: sourceId,
          target_type: toLinkType(r.domain), target_id: id,
          relationship: 'related_to',
        });
        setLinkedIds(prev => new Set(prev).add(id));
        setLinkIdMap(prev => new Map(prev).set(id, res.data.id));
        window.dispatchEvent(new CustomEvent('links-changed'));
        toast.success('Entidad relacionada');
      } catch { toast.error('No se pudo relacionar (¿tipo no permitido?)'); }
    }
  }, [linkedIds, linkIdMap, sourceType, sourceId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>
            <LinkIcon size={14} /> Relacionar entidad
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input autoFocus placeholder="Buscar cualquier entidad…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: '6px 16px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: tab === t.id ? 'var(--amber-dim)' : 'transparent', color: tab === t.id ? 'var(--amber)' : 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {loading && <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Buscando…</div>}
          {!loading && search.trim().length < 2 && <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Escribe al menos 2 caracteres.</div>}
          {!loading && search.trim().length >= 2 && results.length === 0 && <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Sin resultados.</div>}
          {results.map((r) => {
            const { Icon, color } = resolveEntity(r.domain, undefined, r.record as Record<string, unknown> | null);
            const linked = linkedIds.has(r.record_id);
            return (
              <div key={`${r.domain}:${r.record_id}`} onClick={() => toggle(r)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                <Icon size={14} style={{ color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resultTitle(r)}</div>
                  {r.snippet && <div style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.snippet.slice(0, 80)}</div>}
                </div>
                {linked && <Check size={14} style={{ color: 'var(--success, #16a34a)', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
