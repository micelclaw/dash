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

import { HeatBadge } from '@/components/shared/HeatBadge';
import type { GraphNode } from '@/types/intelligence';
import { entityTypeColor, entityTypeShape } from './graph-utils';
import { svgShapePath } from './graph-svg-shapes';

interface GraphNodeTooltipProps {
  node: GraphNode | null;
  position: { x: number; y: number } | null;
}

function TypeShapeIcon({ entityType }: { entityType: string }) {
  const color = entityTypeColor(entityType);
  const shape = entityTypeShape(entityType);
  const r = 6;
  const path = svgShapePath(shape, r);
  return (
    <svg width={14} height={14} viewBox="-7 -7 14 14" style={{ flexShrink: 0 }}>
      {path ? (
        <path d={path} fill={color + '40'} stroke={color} strokeWidth={1} />
      ) : (
        <circle r={r} fill={color + '40'} stroke={color} strokeWidth={1} />
      )}
    </svg>
  );
}

export function GraphNodeTooltip({ node, position }: GraphNodeTooltipProps) {
  if (!node || !position) return null;

  return (
    <div style={{
      position: 'fixed',
      left: position.x + 12,
      top: position.y - 10,
      zIndex: 500,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontFamily: 'var(--font-sans)',
      pointerEvents: 'none',
      maxWidth: 240,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TypeShapeIcon entityType={node.entity_type} />
        <span style={{
          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.name}
        </span>
        <HeatBadge score={node.heat_score} size={6} />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2,
      }}>
        <span style={{ color: entityTypeColor(node.entity_type), textTransform: 'capitalize' }}>
          {node.entity_type}
        </span>
        <span>{node.mention_count} mention{node.mention_count !== 1 ? 's' : ''}</span>
        {node.heat_score > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            heat: {(node.heat_score * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
