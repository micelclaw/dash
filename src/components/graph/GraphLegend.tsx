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

import { entityTypeColor, entityTypeShape, communityColor, linkColor, linkDashArray, significantCommunityIds } from './graph-utils';
import { svgShapePath } from './graph-svg-shapes';
import { GRAPH_RECORD_TYPES } from '@/config/graph-domains';
import type { GraphColorMode, GraphCommunity } from '@/types/intelligence';

interface GraphLegendProps {
  colorMode: GraphColorMode;
  communities?: GraphCommunity[];
  mode?: 'entities' | 'records';
}

const ENTITY_TYPE_LIST = ['person', 'project', 'location', 'topic', 'organization', 'event'];
const RECORD_TYPE_LIST = GRAPH_RECORD_TYPES; // SSOT del grafo (config/graph-domains.ts)

const ENTITY_LINK_TYPES = [
  { key: 'manual', label: 'Manual' },
  { key: 'extracted', label: 'Extracted' },
  { key: 'inferred', label: 'Inferred' },
  { key: 'structural', label: 'Structural' },
];

const RECORD_LINK_TYPES = [
  { key: 'entity_link', label: 'Direct link' },
  { key: 'co_entity', label: 'Shared entities' },
];

function ShapeSwatch({ entityType, color: colorOverride }: { entityType: string; color?: string }) {
  // En modo Calor el color del nodo es el heat (no el del tipo) → la leyenda de formas
  // usa un tono neutro para no implicar el color del tipo; solo importa la figura.
  const color = colorOverride ?? entityTypeColor(entityType);
  const shape = entityTypeShape(entityType);
  const r = 6;
  const path = svgShapePath(shape, r);

  return (
    <svg width={16} height={16} viewBox="-8 -8 16 16" style={{ flexShrink: 0 }}>
      {path ? (
        <path d={path} fill={color + '40'} stroke={color} strokeWidth={1} />
      ) : (
        <circle r={r} fill={color + '40'} stroke={color} strokeWidth={1} />
      )}
    </svg>
  );
}

function LinkSwatch({ linkType }: { linkType: string }) {
  const color = linkColor(linkType);
  const dash = linkDashArray(linkType);
  return (
    <svg width={24} height={10} style={{ flexShrink: 0 }}>
      <line
        x1={0} y1={5} x2={24} y2={5}
        stroke={color}
        strokeWidth={linkType === 'structural' ? 2.5 : 1.5}
        strokeDasharray={dash ?? undefined}
        strokeOpacity={0.8}
      />
    </svg>
  );
}

export function GraphLegend({ colorMode, communities, mode = 'entities' }: GraphLegendProps) {
  const isRecords = mode === 'records';
  const typeList = isRecords ? RECORD_TYPE_LIST : ENTITY_TYPE_LIST;
  const linkTypes = isRecords ? RECORD_LINK_TYPES : ENTITY_LINK_TYPES;
  // Mismas comunidades "significativas" que colorea/agrupa el renderer (size≥3, top-K) → leyenda coherente.
  const significant = significantCommunityIds(communities ?? []);
  const topCommunities = (communities ?? [])
    .filter(c => significant.has(c.community_id))
    .sort((a, b) => b.size - a.size);

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      background: 'rgba(12, 12, 16, 0.8)',
      backdropFilter: 'blur(8px)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.6875rem',
      color: 'var(--text-dim)',
      minWidth: 120,
      maxWidth: 220,
    }}>
      {colorMode === 'community' ? (
        <>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            Comunidades
          </div>
          {topCommunities.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Sin comunidades calculadas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 280, overflowY: 'auto' }}>
              {topCommunities.map(c => (
                <div key={c.community_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: communityColor(c.community_id), border: `1px solid ${communityColor(c.community_id)}` }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label || `Comunidad ${c.community_id}`}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{c.size}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: communityColor(null), border: `1px solid ${communityColor(null)}` }} />
                <span style={{ color: 'var(--text-muted)' }}>Sueltas / otras</span>
              </div>
            </div>
          )}
        </>
      ) : colorMode === 'heat' ? (
        <>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            Heat Map
          </div>
          <div style={{
            height: 8,
            borderRadius: 4,
            background: 'linear-gradient(to right, #38bdf8, #fbbf24, #fb923c, #f43f5e, #dc2626)',
            marginBottom: 4,
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cold</span>
            <span>Hot</span>
          </div>

          {/* Las figuras siguen indicando el TIPO en modo Calor (color = heat, forma = tipo). */}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            {isRecords ? 'Record Types' : 'Entity Types'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {typeList.map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShapeSwatch entityType={type} color="rgba(255,255,255,0.55)" />
                <span style={{ textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            {isRecords ? 'Record Types' : 'Entity Types'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {typeList.map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShapeSwatch entityType={type} />
                <span style={{ textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            Link Types
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {linkTypes.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LinkSwatch linkType={key} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
