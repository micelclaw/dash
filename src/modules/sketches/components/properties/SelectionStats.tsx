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

// ─── Estadísticas de la selección múltiple ──────────────

import { useDiagramsStore } from '@/stores/diagrams.store';
import { Section, SectionTitle, miniLabelStyle, readOnlyValue, statBoxStyle } from './shared';

export function SelectionStats() {
  const nodes = useDiagramsStore((s) => s.nodes);
  const edges = useDiagramsStore((s) => s.edges);

  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdges = edges.filter((e) => e.selected);

  if (selectedNodes.length < 2 && selectedEdges.length === 0) return null;

  // Type distribution
  const typeCounts = new Map<string, number>();
  for (const n of selectedNodes) {
    typeCounts.set(n.type ?? '', (typeCounts.get(n.type ?? '') || 0) + 1);
  }

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of selectedNodes) {
    const w = n.width || n.measured?.width || 160;
    const h = n.height || n.measured?.height || 70;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>Selection</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={statBoxStyle}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-mono, monospace)' }}>
            {selectedNodes.length}
          </span>
          <span style={miniLabelStyle}>nodes</span>
        </div>
        <div style={statBoxStyle}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-mono, monospace)' }}>
            {selectedEdges.length}
          </span>
          <span style={miniLabelStyle}>edges</span>
        </div>
      </div>

      {typeCounts.size > 0 && (
        <Section title="By Type" defaultOpen={false}>
          {Array.from(typeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{type}</span>
                <span style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-mono, monospace)' }}>{count}</span>
              </div>
            ))}
        </Section>
      )}

      {selectedNodes.length >= 2 && minX !== Infinity && (
        <Section title="Bounding Box" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div>
              <span style={miniLabelStyle}>Width</span>
              <span style={{ ...readOnlyValue, fontSize: 10, padding: '2px 6px' }}>{Math.round(maxX - minX)}</span>
            </div>
            <div>
              <span style={miniLabelStyle}>Height</span>
              <span style={{ ...readOnlyValue, fontSize: 10, padding: '2px 6px' }}>{Math.round(maxY - minY)}</span>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
