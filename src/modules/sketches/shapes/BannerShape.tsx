/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { icons } from 'lucide-react';
import type { DiagramNodeData } from '../types';

function BannerShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#d4a017';
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
        background: `${color}12`,
        border: `2px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '0 16px',
      }}
    >
      <NodeResizer color="var(--amber, #d4a017)" isVisible={!!selected} minWidth={140} minHeight={36}
        handleStyle={resizerStyle} lineStyle={{ borderColor: 'var(--amber, #d4a017)', borderWidth: 1, opacity: 0.5 }} />

      {IconComponent && <IconComponent size={18} style={{ color, flexShrink: 0 }} />}
      <span
        style={{
          fontSize: data.fontSize || 14,
          fontWeight: 700,
          color: data.textColor || color,
          fontFamily: 'var(--font-sans, system-ui)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {data.label}
      </span>
      {data.description && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-dim, #94a3b8)',
            fontFamily: 'var(--font-sans, system-ui)',
            whiteSpace: 'nowrap',
          }}
        >
          {data.description}
        </span>
      )}

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

export const BannerShape = memo(BannerShapeInner);
