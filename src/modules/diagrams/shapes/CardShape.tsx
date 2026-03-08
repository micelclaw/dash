import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { icons } from 'lucide-react';
import type { DiagramNodeData } from '../types';

function CardShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#3b82f6';
  const properties = (data.properties || []) as Array<{ key: string; value: string }>;
  const IconComponent = data.icon ? icons[data.icon as keyof typeof icons] : null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        outline: selected ? '2px solid var(--amber, #d4a017)' : 'none',
        outlineOffset: 2,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--surface, #1e1e1e)',
        border: `1px solid ${color}30`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NodeResizer color="var(--amber, #d4a017)" isVisible={!!selected} minWidth={120} minHeight={60}
        handleStyle={resizerStyle} lineStyle={{ borderColor: 'var(--amber, #d4a017)', borderWidth: 1, opacity: 0.5 }} />

      {/* Color bar */}
      <div style={{ height: 4, background: color, flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '8px 10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {IconComponent && <IconComponent size={16} style={{ color, flexShrink: 0 }} />}
          <span
            style={{
              fontSize: data.fontSize || 12,
              fontWeight: 600,
              color: data.textColor || '#e2e8f0',
              fontFamily: 'var(--font-sans, system-ui)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data.label}
          </span>
        </div>

        {/* Description */}
        {data.description && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-dim, #94a3b8)',
              fontFamily: 'var(--font-sans, system-ui)',
              lineHeight: 1.3,
            }}
          >
            {data.description}
          </span>
        )}

        {/* Properties */}
        {properties.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--border, #333)', margin: '2px 0' }} />
            {properties.map((prop, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--text-dim, #94a3b8)',
                  gap: 8,
                }}
              >
                <span style={{ color: '#64748b' }}>{prop.key}</span>
                <span>{prop.value}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />
    </div>
  );
}

const resizerStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 2,
  background: 'var(--amber, #d4a017)', border: '1px solid var(--surface, #1e1e1e)',
};

const handleStyle: React.CSSProperties = {
  width: 8, height: 8,
  background: 'var(--text-dim, #64748b)',
  border: '2px solid var(--surface, #1e1e1e)',
};

export const CardShape = memo(CardShapeInner);
