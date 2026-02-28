/** Heat color interpolation: 6 stops from cold blue → hot red */
const HEAT_STOPS = [
  { t: 0.0, r: 56, g: 189, b: 248 },  // #38bdf8 — cold
  { t: 0.2, r: 56, g: 189, b: 248 },  // #38bdf8 — cold boundary
  { t: 0.4, r: 251, g: 191, b: 36 },  // #fbbf24 — warm
  { t: 0.6, r: 251, g: 146, b: 60 },  // #fb923c — warm-hot
  { t: 0.8, r: 244, g: 63, b: 94 },   // #f43f5e — hot
  { t: 1.0, r: 220, g: 38, b: 38 },   // #dc2626 — very hot
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function heatColor(score: number): string {
  const s = Math.max(0, Math.min(1, score));
  if (s === 0) return 'rgba(56, 189, 248, 0.3)';

  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const a = HEAT_STOPS[i]!;
    const b = HEAT_STOPS[i + 1]!;
    if (s >= a.t && s <= b.t) {
      const t = (s - a.t) / (b.t - a.t);
      const r = Math.round(lerp(a.r, b.r, t));
      const g = Math.round(lerp(a.g, b.g, t));
      const bl = Math.round(lerp(a.b, b.b, t));
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  return '#dc2626';
}

/** Same interpolation as heatColor but returns numeric {r,g,b} for canvas rgba() usage. */
export function heatColorRGB(score: number): { r: number; g: number; b: number } {
  const s = Math.max(0, Math.min(1, score));
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const a = HEAT_STOPS[i]!;
    const b = HEAT_STOPS[i + 1]!;
    if (s >= a.t && s <= b.t) {
      const t = (s - a.t) / (b.t - a.t);
      return {
        r: Math.round(lerp(a.r, b.r, t)),
        g: Math.round(lerp(a.g, b.g, t)),
        b: Math.round(lerp(a.b, b.b, t)),
      };
    }
  }
  return { r: 220, g: 38, b: 38 };
}

const TYPE_COLORS: Record<string, string> = {
  // Entity types
  person: '#60a5fa',
  project: '#a78bfa',
  location: '#34d399',
  topic: '#fbbf24',
  organization: '#f472b6',
  event: '#fb923c',
  // Record types
  contact: '#ec4899',
  note:    '#8b5cf6',
  email:   '#06b6d4',
  file:    '#84cc16',
  diary:   '#f43f5e',
};

export function entityTypeColor(entityType: string): string {
  return TYPE_COLORS[entityType] ?? '#94a3b8';
}

/** Node size based on mention count (log scale, 6–44px) */
export function nodeSize(mentionCount: number): number {
  if (mentionCount <= 0) return 6;
  return Math.min(44, 6 + Math.log2(mentionCount + 1) * 6);
}

/** Shape paths for entity types */
export type NodeShape = 'circle' | 'diamond' | 'square' | 'triangle' | 'hexagon' | 'octagon';

export function entityTypeShape(entityType: string): NodeShape {
  switch (entityType) {
    // Entity types
    case 'person': return 'circle';
    case 'project': return 'square';
    case 'location': return 'diamond';
    case 'topic': return 'hexagon';
    case 'organization': return 'octagon';
    case 'event': return 'triangle';
    // Record types
    case 'contact': return 'circle';
    case 'note':    return 'square';
    case 'email':   return 'diamond';
    case 'file':    return 'triangle';
    case 'diary':   return 'octagon';
    default: return 'circle';
  }
}

/** Draw a shape on canvas */
export function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: NodeShape,
  fillColor: string,
  strokeColor: string,
) {
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  const r = size / 2;

  switch (shape) {
    case 'circle':
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      break;
    case 'square':
      ctx.rect(x - r, y - r, size, size);
      break;
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.7);
      ctx.lineTo(x - r, y + r * 0.7);
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case 'octagon':
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 8;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
  }

  ctx.fill();
  ctx.stroke();
}

// ─── SVG / D3 Link Utilities ──────────────────────────────────────

/** Link color based on link_type. For 'extracted', pass the target node's entity_type. */
export function linkColor(linkType: string, targetNodeType?: string): string {
  switch (linkType) {
    case 'manual': return '#d4a017';
    case 'extracted': return targetNodeType ? entityTypeColor(targetNodeType) : '#94a3b8';
    case 'inferred': return '#64748b';
    case 'structural': return '#10b981';
    case 'entity_link': return '#fbbf24';  // amber — direct record-to-record link
    case 'co_entity':   return '#a78bfa';  // purple — shared extracted entity
    default: return '#94a3b8';
  }
}

/** SVG stroke-dasharray for link_type. Returns null for solid lines. */
export function linkDashArray(linkType: string): string | null {
  return linkType === 'inferred' ? '4 3' : null;
}

/** Link stroke width from strength (1–3px). */
export function linkStrokeWidth(strength: number | null): number {
  return Math.max(1, Math.min(3, 1 + (strength ?? 0.5) * 2));
}

/** Expand a polygon outward by `padding` pixels (for hull rendering). */
export function expandPolygon(points: [number, number][], padding: number): [number, number][] {
  if (points.length < 3) return points;
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return [x + (dx / dist) * padding, y + (dy / dist) * padding] as [number, number];
  });
}

/** Expose TYPE_COLORS for the legend component. */
export { TYPE_COLORS };
