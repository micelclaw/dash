import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { DiagramNodeData } from '../types';

function SeparatorShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#6b7280';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        outline: selected ? '2px solid var(--amber, #d4a017)' : 'none',
        outlineOffset: 2,
      }}
    >
      <NodeResizer
        color="var(--amber, #d4a017)"
        isVisible={!!selected}
        minWidth={60}
        minHeight={8}
        handleStyle={resizerStyle}
        lineStyle={{ borderColor: 'var(--amber, #d4a017)', borderWidth: 1, opacity: 0.5 }}
      />
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ flex: 1, height: 2, background: color, opacity: 0.5 }} />
        {data.label && (
          <span
            style={{
              fontSize: data.fontSize || 10,
              color: data.textColor || color,
              fontFamily: 'var(--font-sans, system-ui)',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            {data.label}
          </span>
        )}
        <div style={{ flex: 1, height: 2, background: color, opacity: 0.5 }} />
      </div>

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

export const SeparatorShape = memo(SeparatorShapeInner);
