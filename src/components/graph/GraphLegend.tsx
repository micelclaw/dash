import { TYPE_COLORS, entityTypeShape, linkColor, linkDashArray } from './graph-utils';
import { svgShapePath } from './graph-svg-shapes';

interface GraphLegendProps {
  heatMapMode: boolean;
}

const ENTITY_TYPES = Object.keys(TYPE_COLORS);

const LINK_TYPES = [
  { key: 'manual', label: 'Manual' },
  { key: 'extracted', label: 'Extracted' },
  { key: 'inferred', label: 'Inferred' },
  { key: 'structural', label: 'Structural' },
];

function ShapeSwatch({ entityType }: { entityType: string }) {
  const color = TYPE_COLORS[entityType] ?? '#94a3b8';
  const shape = entityTypeShape(entityType);
  const r = 6;
  const path = svgShapePath(shape, r);

  return (
    <svg width={16} height={16} viewBox="-8 -8 16 16" style={{ flexShrink: 0 }}>
      {path ? (
        <path d={path} fill={color + '40'} stroke={color} strokeWidth={1} />
      ) : (
        <circle r={r} fill={color + '40'} stroke={color} strokeWidth={1} />
      )}
    </svg>
  );
}

function LinkSwatch({ linkType }: { linkType: string }) {
  const color = linkColor(linkType);
  const dash = linkDashArray(linkType);
  return (
    <svg width={24} height={10} style={{ flexShrink: 0 }}>
      <line
        x1={0} y1={5} x2={24} y2={5}
        stroke={color}
        strokeWidth={linkType === 'structural' ? 2.5 : 1.5}
        strokeDasharray={dash ?? undefined}
        strokeOpacity={0.8}
      />
    </svg>
  );
}

export function GraphLegend({ heatMapMode }: GraphLegendProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      background: 'rgba(12, 12, 16, 0.8)',
      backdropFilter: 'blur(8px)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.6875rem',
      color: 'var(--text-dim)',
      minWidth: 120,
    }}>
      {heatMapMode ? (
        <>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            Heat Map
          </div>
          <div style={{
            height: 8,
            borderRadius: 4,
            background: 'linear-gradient(to right, #38bdf8, #fbbf24, #fb923c, #f43f5e, #dc2626)',
            marginBottom: 4,
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cold</span>
            <span>Hot</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            Entity Types
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {ENTITY_TYPES.map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShapeSwatch entityType={type} />
                <span style={{ textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: '0.6875rem' }}>
            Link Types
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {LINK_TYPES.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LinkSwatch linkType={key} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
