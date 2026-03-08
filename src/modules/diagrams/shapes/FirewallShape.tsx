import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function FirewallShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#ef4444';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Brick wall */}
        <rect x="2" y="2" width="96" height="96" rx="4"
          fill={data.bgColor || color} fillOpacity={0.12}
          stroke={color} strokeWidth="2" />
        {/* Brick rows */}
        <line x1="2" y1="25" x2="98" y2="25" stroke={color} strokeWidth="1" strokeOpacity="0.25" />
        <line x1="2" y1="50" x2="98" y2="50" stroke={color} strokeWidth="1" strokeOpacity="0.25" />
        <line x1="2" y1="75" x2="98" y2="75" stroke={color} strokeWidth="1" strokeOpacity="0.25" />
        {/* Vertical brick lines (staggered) */}
        <line x1="35" y1="2" x2="35" y2="25" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="70" y1="2" x2="70" y2="25" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="20" y1="25" x2="20" y2="50" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="55" y1="25" x2="55" y2="50" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="85" y1="25" x2="85" y2="50" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="35" y1="50" x2="35" y2="75" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="70" y1="50" x2="70" y2="75" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="20" y1="75" x2="20" y2="98" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="55" y1="75" x2="55" y2="98" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="85" y1="75" x2="85" y2="98" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
      </svg>
    </BaseShape>
  );
}

export const FirewallShape = memo(FirewallShapeInner);
