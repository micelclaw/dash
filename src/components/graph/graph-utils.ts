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

const TYPE_COLORS: Record<string, string> = {
  person: '#60a5fa',
  project: '#a78bfa',
  location: '#34d399',
  topic: '#fbbf24',
  organization: '#f472b6',
  event: '#fb923c',
};

export function entityTypeColor(entityType: string): string {
  return TYPE_COLORS[entityType] ?? '#94a3b8';
}

/** Node size based on mention count (log scale, 8–32px) */
export function nodeSize(mentionCount: number): number {
  if (mentionCount <= 0) return 8;
  return Math.min(32, 8 + Math.log2(mentionCount + 1) * 4);
}

/** Shape paths for entity types */
export type NodeShape = 'circle' | 'diamond' | 'square' | 'triangle' | 'hexagon' | 'octagon';

export function entityTypeShape(entityType: string): NodeShape {
  switch (entityType) {
    case 'person': return 'circle';
    case 'project': return 'square';
    case 'location': return 'diamond';
    case 'topic': return 'hexagon';
    case 'organization': return 'octagon';
    case 'event': return 'triangle';
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
