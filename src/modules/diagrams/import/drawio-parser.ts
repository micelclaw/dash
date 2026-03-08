/**
 * Parse draw.io XML into our DiagramFile format.
 * Handles basic mxCell shapes, edges, labels, positions, and colors.
 */
import type { DiagramFile, DiagramNode, DiagramEdge } from '../types';
import { DEFAULT_SETTINGS } from '../types';

// Map draw.io shape styles to our types
const SHAPE_MAP: Record<string, string> = {
  'shape=mxgraph.flowchart.decision': 'diamond',
  'ellipse': 'circle',
  'rhombus': 'diamond',
  'cylinder3': 'cylinder',
  'cloud': 'cloud',
  'document': 'document',
  'hexagon': 'hexagon',
  'parallelogram': 'parallelogram',
  'triangle': 'triangle',
  'trapezoid': 'trapezoid',
};

function parseStyle(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!style) return result;
  for (const part of style.split(';')) {
    const [key, val] = part.split('=');
    if (key && val) result[key] = val;
    else if (key) result[key] = 'true';
  }
  return result;
}

function detectShapeType(style: Record<string, string>): string {
  const styleStr = Object.entries(style).map(([k, v]) => `${k}=${v}`).join(';');
  for (const [pattern, type] of Object.entries(SHAPE_MAP)) {
    if (styleStr.includes(pattern)) return type;
  }
  if (style['rounded'] === '1') return 'rounded';
  return 'rectangle';
}

function hexColor(color: string | undefined): string | undefined {
  if (!color || color === 'none') return undefined;
  if (color.startsWith('#')) return color;
  return color;
}

export function parseDrawio(xml: string): DiagramFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const cells = doc.querySelectorAll('mxCell');
  let nodeIdx = 0;

  cells.forEach((cell) => {
    const id = cell.getAttribute('id') || '';
    const parent = cell.getAttribute('parent') || '';
    const value = cell.getAttribute('value') || '';
    const style = parseStyle(cell.getAttribute('style') || '');
    const source = cell.getAttribute('source') || '';
    const target = cell.getAttribute('target') || '';
    const vertex = cell.getAttribute('vertex') === '1';
    const edge = cell.getAttribute('edge') === '1';

    const geom = cell.querySelector('mxGeometry');
    const x = geom ? parseFloat(geom.getAttribute('x') || '0') : nodeIdx * 200;
    const y = geom ? parseFloat(geom.getAttribute('y') || '0') : 0;
    const w = geom ? parseFloat(geom.getAttribute('width') || '120') : 120;
    const h = geom ? parseFloat(geom.getAttribute('height') || '60') : 60;

    if (vertex && id !== '0' && id !== '1') {
      const shapeType = detectShapeType(style);
      const label = value.replace(/<[^>]+>/g, '').trim() || `Node ${++nodeIdx}`;

      nodes.push({
        id,
        type: shapeType,
        position: { x, y },
        data: {
          label,
          color: hexColor(style['strokeColor']) || hexColor(style['fillColor']) || '#3b82f6',
          bgColor: hexColor(style['fillColor']),
          textColor: hexColor(style['fontColor']),
          fontSize: style['fontSize'] ? parseInt(style['fontSize']) : undefined,
        },
        width: w,
        height: h,
      });
    }

    if (edge && source && target) {
      edges.push({
        id,
        source,
        target,
        type: style['edgeStyle']?.includes('orthogonalEdgeStyle') ? 'step' : 'smoothstep',
        label: value.replace(/<[^>]+>/g, '').trim() || undefined,
        data: {
          color: hexColor(style['strokeColor']),
          strokeWidth: style['strokeWidth'] ? parseFloat(style['strokeWidth']) : undefined,
          dashed: style['dashed'] === '1',
        },
      });
    }
  });

  return {
    version: '2.0.0',
    title: 'Imported Diagram',
    description: 'Imported from draw.io',
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes,
    edges,
    settings: { ...DEFAULT_SETTINGS },
  };
}
