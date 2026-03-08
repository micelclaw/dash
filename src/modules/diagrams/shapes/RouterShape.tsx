import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function RouterShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#22c55e';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 70" preserveAspectRatio="none">
        {/* Router body */}
        <rect x="5" y="20" width="90" height="40" rx="5"
          fill={data.bgColor || color} fillOpacity={0.15}
          stroke={color} strokeWidth="2" />
        {/* Antennas */}
        <line x1="25" y1="20" x2="18" y2="5" stroke={color} strokeWidth="2" />
        <circle cx="18" cy="5" r="2.5" fill={color} fillOpacity="0.4" />
        <line x1="75" y1="20" x2="82" y2="5" stroke={color} strokeWidth="2" />
        <circle cx="82" cy="5" r="2.5" fill={color} fillOpacity="0.4" />
        {/* LEDs */}
        <circle cx="20" cy="40" r="3" fill={color} fillOpacity="0.5" />
        <circle cx="32" cy="40" r="3" fill={color} fillOpacity="0.3" />
        <circle cx="44" cy="40" r="3" fill={color} fillOpacity="0.3" />
        {/* Ports */}
        <rect x="60" y="48" width="8" height="5" rx="1" fill={color} fillOpacity="0.2" />
        <rect x="72" y="48" width="8" height="5" rx="1" fill={color} fillOpacity="0.2" />
        <rect x="84" y="48" width="8" height="5" rx="1" fill={color} fillOpacity="0.2" />
      </svg>
    </BaseShape>
  );
}

export const RouterShape = memo(RouterShapeInner);
