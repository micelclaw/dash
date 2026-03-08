import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function StackShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#06b6d4';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Bottom layer */}
        <rect x="8" y="12" width="88" height="84" rx="4"
          fill={data.bgColor || color} fillOpacity={0.08}
          stroke={color} strokeWidth="1.5" />
        {/* Middle layer */}
        <rect x="4" y="6" width="88" height="84" rx="4"
          fill={data.bgColor || color} fillOpacity={0.1}
          stroke={color} strokeWidth="1.5" />
        {/* Top layer */}
        <rect x="0" y="0" width="88" height="84" rx="4"
          fill={data.bgColor || color} fillOpacity={0.15}
          stroke={color} strokeWidth="2" />
      </svg>
    </BaseShape>
  );
}

export const StackShape = memo(StackShapeInner);
