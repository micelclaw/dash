import { HeatBadge } from '@/components/shared/HeatBadge';
import type { GraphEdge } from '@/types/intelligence';
import { linkColor, linkDashArray } from './graph-utils';

interface GraphEdgePopoverProps {
  edge: GraphEdge | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

function LinkStylePreview({ linkType }: { linkType: string }) {
  const color = linkColor(linkType);
  const dash = linkDashArray(linkType);
  return (
    <svg width={32} height={8} style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <line
        x1={0} y1={4} x2={32} y2={4}
        stroke={color}
        strokeWidth={linkType === 'structural' ? 2.5 : 1.5}
        strokeDasharray={dash ?? undefined}
        strokeOpacity={0.9}
      />
    </svg>
  );
}

export function GraphEdgePopover({ edge, position, onClose }: GraphEdgePopoverProps) {
  if (!edge || !position) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 499,
          background: 'transparent',
        }}
      />
      <div style={{
        position: 'fixed',
        left: position.x + 8,
        top: position.y - 8,
        zIndex: 500,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontFamily: 'var(--font-sans)',
        maxWidth: 260,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        {edge.relationship && (
          <div style={{
            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)',
            marginBottom: 4,
          }}>
            {edge.relationship}
          </div>
        )}

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          fontSize: '0.6875rem', color: 'var(--text-dim)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Type:</span>
            <LinkStylePreview linkType={edge.link_type} />
            <span style={{ color: 'var(--text)' }}>{edge.link_type}</span>
          </div>
          {edge.confidence != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Confidence:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                {(edge.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {edge.strength != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Strength:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                {(edge.strength * 100).toFixed(0)}%
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Heat:</span>
            <HeatBadge score={edge.heat_edge} size={6} />
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
              {(edge.heat_edge * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
