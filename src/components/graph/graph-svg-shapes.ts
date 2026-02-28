import type { NodeShape } from './graph-utils';

/**
 * Generate an SVG `d` attribute for a shape centered at (0,0).
 * For 'circle', returns null — use a <circle> element instead.
 */
export function svgShapePath(shape: NodeShape, r: number): string | null {
  switch (shape) {
    case 'circle':
      return null; // use <circle r={r}>
    case 'square': {
      const s = r * 0.85; // slightly inset so area ≈ circle
      return `M${-s},${-s}L${s},${-s}L${s},${s}L${-s},${s}Z`;
    }
    case 'diamond':
      return `M0,${-r}L${r},0L0,${r}L${-r},0Z`;
    case 'triangle': {
      const h = r * 0.87; // equilateral-ish
      return `M0,${-r}L${h},${r * 0.7}L${-h},${r * 0.7}Z`;
    }
    case 'hexagon':
      return regularPolygonPath(6, r);
    case 'octagon':
      return regularPolygonPath(8, r);
    default:
      return null;
  }
}

function regularPolygonPath(sides: number, r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  parts.push('Z');
  return parts.join('');
}

/**
 * Create the appropriate SVG element for a node shape inside a <g>.
 * Returns { tag, attrs } so the caller can d3.append(tag).attr(attrs).
 */
export function nodeShapeAttrs(
  shape: NodeShape,
  r: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
): { tag: string; attrs: Record<string, string | number> } {
  const d = svgShapePath(shape, r);
  if (d === null) {
    return {
      tag: 'circle',
      attrs: { r, fill, stroke, 'stroke-width': strokeWidth },
    };
  }
  return {
    tag: 'path',
    attrs: { d, fill, stroke, 'stroke-width': strokeWidth },
  };
}
