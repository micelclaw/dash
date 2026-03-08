import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { icons } from 'lucide-react';
import type { DiagramNodeData } from '../types';

const TYPE_ICONS: Record<string, string> = {
  pk: '\u26B7',  // key symbol
  fk: '\u2192',  // arrow
  field: '\u00B7', // middle dot
};

function TableShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#3b82f6';
  const rows = (data.rows || []) as Array<{ key: string; value: string; type?: string }>;
  const IconComponent = data.icon ? icons[data.icon as keyof typeof icons] : null;
  const [hovered, setHovered] = useState(false);
  const showHandles = hovered || selected;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        height: '100%',
        outline: selected ? '2px solid var(--amber, #d4a017)' : 'none',
        outlineOffset: 2,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--surface, #1e1e1e)',
        border: `1px solid ${color}40`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NodeResizer color="var(--amber, #d4a017)" isVisible={!!selected} minWidth={120} minHeight={60}
        handleStyle={resizerStyle} lineStyle={{ borderColor: 'var(--amber, #d4a017)', borderWidth: 1, opacity: 0.5 }} />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: `${color}20`,
          borderBottom: `1px solid ${color}30`,
          flexShrink: 0,
        }}
      >
        {IconComponent && <IconComponent size={14} style={{ color, flexShrink: 0 }} />}
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

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '2px 0', position: 'relative' }}>
        {rows.length > 0 ? (
          rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px',
                fontSize: 10,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                color: 'var(--text-dim, #94a3b8)',
                position: 'relative',
              }}
            >
              <span style={{ width: 10, textAlign: 'center', color: row.type === 'pk' ? '#d4a017' : row.type === 'fk' ? '#3b82f6' : '#64748b' }}>
                {TYPE_ICONS[row.type || 'field'] || TYPE_ICONS.field}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.key}</span>
              <span style={{ color: '#64748b', fontSize: 9 }}>{row.value}</span>
              {/* Per-row handle on the right */}
              <Handle
                type="source"
                position={Position.Right}
                id={`row-${i}`}
                style={{
                  ...(showHandles ? handleVisibleStyle : handleHiddenStyle),
                  top: '50%',
                  right: -4,
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          ))
        ) : (
          <div style={{ padding: '4px 10px', fontSize: 10, color: '#475569', fontStyle: 'italic' }}>
            {data.description || 'No columns'}
          </div>
        )}
      </div>

      {/* Main handles */}
      <Handle type="target" position={Position.Top} style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
      <Handle type="source" position={Position.Bottom} style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
      <Handle type="target" position={Position.Left} id="left" style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
      <Handle type="source" position={Position.Right} id="right" style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
    </div>
  );
}

const resizerStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 2,
  background: 'var(--amber, #d4a017)', border: '1px solid var(--surface, #1e1e1e)',
};

const handleVisibleStyle: React.CSSProperties = {
  width: 8, height: 8,
  background: 'var(--text-dim, #64748b)',
  border: '2px solid var(--surface, #1e1e1e)',
  opacity: 1,
  transition: 'opacity 0.15s',
};

const handleHiddenStyle: React.CSSProperties = {
  width: 8, height: 8,
  background: 'var(--text-dim, #64748b)',
  border: '2px solid var(--surface, #1e1e1e)',
  opacity: 0,
  transition: 'opacity 0.15s',
};

export const TableShape = memo(TableShapeInner);
