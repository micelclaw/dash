import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function DesktopShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#6b7280';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 120 100" preserveAspectRatio="none">
        {/* Monitor */}
        <rect x="5" y="5" width="110" height="70" rx="5"
          fill={data.bgColor || color} fillOpacity={0.12}
          stroke={color} strokeWidth="2" />
        {/* Screen */}
        <rect x="10" y="10" width="100" height="55" rx="2"
          fill={color} fillOpacity={0.06} />
        {/* Stand */}
        <rect x="45" y="75" width="30" height="10" rx="1"
          fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
        {/* Base */}
        <rect x="30" y="85" width="60" height="6" rx="3"
          fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
      </svg>
    </BaseShape>
  );
}

export const DesktopShape = memo(DesktopShapeInner);
