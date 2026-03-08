/**
 * Parse Mermaid flowchart/graph syntax into DiagramFile format.
 * Supports: flowchart/graph TD/LR, node shapes, labels, edges with labels.
 */
import type { DiagramFile, DiagramNode, DiagramEdge } from '../types';
import { DEFAULT_SETTINGS, SHAPE_DEFAULTS } from '../types';

interface ParsedNode {
  id: string;
  label: string;
  shape: string;
}

interface ParsedEdge {
  source: string;
  target: string;
  label?: string;
}

function detectShape(text: string): { id: string; label: string; shape: string } {
  // [label] → rectangle
  let m = text.match(/^(\w+)\[(.+)\]$/);
  if (m) return { id: m[1], label: m[2], shape: 'rectangle' };

  // (label) → rounded
  m = text.match(/^(\w+)\((.+)\)$/);
  if (m) return { id: m[1], label: m[2], shape: 'rounded' };

  // {label} → diamond
  m = text.match(/^(\w+)\{(.+)\}$/);
  if (m) return { id: m[1], label: m[2], shape: 'diamond' };

  // ((label)) → circle
  m = text.match(/^(\w+)\(\((.+)\)\)$/);
  if (m) return { id: m[1], label: m[2], shape: 'circle' };

  // [(label)] → cylinder
  m = text.match(/^(\w+)\[\((.+)\)\]$/);
  if (m) return { id: m[1], label: m[2], shape: 'cylinder' };

  // [/label\] → parallelogram
  m = text.match(/^(\w+)\[\/(.+)\\?\]$/);
  if (m) return { id: m[1], label: m[2], shape: 'parallelogram' };

  // {{label}} → hexagon
  m = text.match(/^(\w+)\{\{(.+)\}\}$/);
  if (m) return { id: m[1], label: m[2], shape: 'hexagon' };

  // >label] → banner
  m = text.match(/^(\w+)>(.+)\]$/);
  if (m) return { id: m[1], label: m[2], shape: 'banner' };

  // Plain id
  return { id: text.trim(), label: text.trim(), shape: 'rectangle' };
}

export function parseMermaid(source: string): DiagramFile {
  const lines = source.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));

  const nodeMap = new Map<string, ParsedNode>();
  const edgeList: ParsedEdge[] = [];

  for (const line of lines) {
    // Skip header lines
    if (/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)/i.test(line)) continue;
    if (/^(subgraph|end|classDef|class|style)\b/i.test(line)) continue;

    // Edge patterns: A --> B, A -->|label| B, A -- label --> B
    const edgeMatch = line.match(/^(\S+)\s*(-->|---|-\.-|==>|-.->|--)\s*(?:\|([^|]+)\|)?\s*(\S+)$/);
    if (edgeMatch) {
      const src = detectShape(edgeMatch[1]);
      const tgt = detectShape(edgeMatch[4]);
      const label = edgeMatch[3]?.trim();

      if (!nodeMap.has(src.id)) nodeMap.set(src.id, src);
      if (!nodeMap.has(tgt.id)) nodeMap.set(tgt.id, tgt);

      edgeList.push({ source: src.id, target: tgt.id, label });
      continue;
    }

    // Edge with label in middle: A -- label --> B
    const edgeMatch2 = line.match(/^(\S+)\s+--\s+(.+?)\s+-->\s+(\S+)$/);
    if (edgeMatch2) {
      const src = detectShape(edgeMatch2[1]);
      const tgt = detectShape(edgeMatch2[3]);
      const label = edgeMatch2[2]?.trim();

      if (!nodeMap.has(src.id)) nodeMap.set(src.id, src);
      if (!nodeMap.has(tgt.id)) nodeMap.set(tgt.id, tgt);

      edgeList.push({ source: src.id, target: tgt.id, label });
      continue;
    }

    // Standalone node definition: A[Label]
    const nodeOnly = detectShape(line);
    if (nodeOnly.id && !nodeMap.has(nodeOnly.id)) {
      nodeMap.set(nodeOnly.id, nodeOnly);
    }
  }

  // Position nodes in a grid
  const nodeArr = Array.from(nodeMap.values());
  const cols = Math.ceil(Math.sqrt(nodeArr.length));
  const nodes: DiagramNode[] = nodeArr.map((n, i) => {
    const defaults = SHAPE_DEFAULTS[n.shape as keyof typeof SHAPE_DEFAULTS] || SHAPE_DEFAULTS.rectangle;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: n.id,
      type: n.shape,
      position: { x: col * 220 + 50, y: row * 140 + 50 },
      data: {
        label: n.label,
        color: defaults.color,
      },
      width: defaults.width,
      height: defaults.height,
    };
  });

  const edges: DiagramEdge[] = edgeList.map((e, i) => ({
    id: `edge-mmd-${i}`,
    source: e.source,
    target: e.target,
    type: 'smoothstep',
    label: e.label,
  }));

  return {
    version: '2.0.0',
    title: 'Imported from Mermaid',
    description: '',
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes,
    edges,
    settings: { ...DEFAULT_SETTINGS },
  };
}
