import { entityTypeColor, entityTypeShape, linkColor, linkDashArray } from './graph-utils';
import { svgShapePath } from './graph-svg-shapes';

interface GraphLegendProps {
  heatMapMode: boolean;
  mode?: 'entities' | 'records';
}

const ENTITY_TYPE_LIST = ['person', 'project', 'location', 'topic', 'organization', 'event'];
const RECORD_TYPE_LIST = ['contact', 'note', 'email', 'event', 'file', 'diary'];

const ENTITY_LINK_TYPES = [
  { key: 'manual', label: 'Manual' },
  { key: 'extracted', label: 'Extracted' },
  { key: 'inferred', label: 'Inferred' },
  { key: 'structural', label: 'Structural' },
];

const RECORD_LINK_TYPES = [
  { key: 'entity_link', label: 'Direct link' },
  { key: 'co_entity', label: 'Shared entities' },
];

function ShapeSwatch({ entityType }: { entityType: string }) {
  const color = entityTypeColor(entityType);
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

export function GraphLegend({ heatMapMode, mode = 'entities' }: GraphLegendProps) {
  const isRecords = mode === 'records';
  const typeList = isRecords ? RECORD_TYPE_LIST : ENTITY_TYPE_LIST;
  const linkTypes = isRecords ? RECORD_LINK_TYPES : ENTITY_LINK_TYPES;

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
            {isRecords ? 'Record Types' : 'Entity Types'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {typeList.map(type => (
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
            {linkTypes.map(({ key, label }) => (
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
