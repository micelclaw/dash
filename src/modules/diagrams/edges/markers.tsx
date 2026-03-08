import type { EdgeMarkerType } from '../types';

// SVG marker IDs
const MARKER_IDS: Record<string, string> = {
  arrow: 'claw-marker-arrow',
  arrowClosed: 'claw-marker-arrow-closed',
  diamond: 'claw-marker-diamond',
  circle: 'claw-marker-circle',
};

/**
 * Convert our marker type to a React Flow markerEnd/markerStart URL string.
 */
export function resolveMarker(marker: EdgeMarkerType | undefined, color?: string): string | undefined {
  if (!marker || marker === 'none') return undefined;
  const id = MARKER_IDS[marker];
  if (!id) return undefined;
  // Append color suffix for colored variants
  const colorSuffix = color ? `-${color.replace('#', '')}` : '';
  return `url(#${id}${colorSuffix})`;
}

/**
 * SVG <defs> for custom edge markers. Render once inside the ReactFlow canvas.
 */
export function MarkerDefs() {
  const colors = ['#64748b', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280', '#d4a017'];

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {colors.map((color) => {
          const suffix = `-${color.replace('#', '')}`;
          return (
            <g key={color}>
              {/* Arrow (open) */}
              <marker
                id={`claw-marker-arrow${suffix}`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerWidth="10"
                markerHeight="10"
                orient="auto-start-reverse"
              >
                <path d="M 2 2 L 10 6 L 2 10" fill="none" stroke={color} strokeWidth="1.5" />
              </marker>

              {/* Arrow Closed (filled) */}
              <marker
                id={`claw-marker-arrow-closed${suffix}`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerWidth="10"
                markerHeight="10"
                orient="auto-start-reverse"
              >
                <path d="M 2 2 L 10 6 L 2 10 Z" fill={color} stroke={color} strokeWidth="1" />
              </marker>

              {/* Diamond */}
              <marker
                id={`claw-marker-diamond${suffix}`}
                viewBox="0 0 14 14"
                refX="7"
                refY="7"
                markerWidth="12"
                markerHeight="12"
                orient="auto-start-reverse"
              >
                <path d="M 1 7 L 7 1 L 13 7 L 7 13 Z" fill={color} stroke={color} strokeWidth="0.5" />
              </marker>

              {/* Circle */}
              <marker
                id={`claw-marker-circle${suffix}`}
                viewBox="0 0 12 12"
                refX="6"
                refY="6"
                markerWidth="10"
                markerHeight="10"
                orient="auto-start-reverse"
              >
                <circle cx="6" cy="6" r="4" fill={color} stroke={color} strokeWidth="0.5" />
              </marker>
            </g>
          );
        })}
      </defs>
    </svg>
  );
}
