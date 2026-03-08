import type { LassoState } from '../hooks/use-lasso';

interface LassoOverlayProps {
  lasso: LassoState;
}

/**
 * SVG overlay that renders the freeform lasso selection path.
 * Uses screen coordinates (positioned over the canvas).
 */
export function LassoOverlay({ lasso }: LassoOverlayProps) {
  if (!lasso.isDrawing || lasso.points.length < 2) return null;

  const d = lasso.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      <path
        d={d}
        fill="rgba(212, 160, 23, 0.05)"
        stroke="var(--amber, #d4a017)"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
    </svg>
  );
}
