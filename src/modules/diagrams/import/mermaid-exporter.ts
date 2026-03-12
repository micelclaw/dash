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

/**
 * Export DiagramFile to Mermaid flowchart syntax.
 */
import type { DiagramFile } from '../types';

// Map our shape types to Mermaid node syntax
function wrapLabel(id: string, label: string, type: string): string {
  const safeLabel = label.replace(/"/g, '#quot;');
  switch (type) {
    case 'rounded':       return `${id}("${safeLabel}")`;
    case 'diamond':       return `${id}{"${safeLabel}"}`;
    case 'circle':        return `${id}(("${safeLabel}"))`;
    case 'cylinder':      return `${id}[("${safeLabel}")]`;
    case 'hexagon':       return `${id}{{"${safeLabel}"}}`;
    case 'parallelogram': return `${id}[/"${safeLabel}"/]`;
    case 'banner':        return `${id}>"${safeLabel}"]`;
    default:              return `${id}["${safeLabel}"]`;
  }
}

function sanitizeId(id: string): string {
  // Mermaid IDs can't have special chars — replace with underscores
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function exportMermaid(diagram: DiagramFile): string {
  const lines: string[] = ['flowchart TD'];

  // Build ID mapping (sanitized)
  const idMap = new Map<string, string>();
  for (const node of diagram.nodes) {
    const safeId = sanitizeId(node.id);
    idMap.set(node.id, safeId);
  }

  // Node definitions
  for (const node of diagram.nodes) {
    const safeId = idMap.get(node.id) || sanitizeId(node.id);
    lines.push(`    ${wrapLabel(safeId, node.data.label || safeId, node.type)}`);
  }

  // Edges
  for (const edge of diagram.edges) {
    const src = idMap.get(edge.source) || sanitizeId(edge.source);
    const tgt = idMap.get(edge.target) || sanitizeId(edge.target);
    const arrow = edge.data?.dashed ? '-.->' : edge.animated ? '==>' : '-->';

    if (edge.label) {
      lines.push(`    ${src} ${arrow}|${edge.label}| ${tgt}`);
    } else {
      lines.push(`    ${src} ${arrow} ${tgt}`);
    }
  }

  return lines.join('\n');
}
