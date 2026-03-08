import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function CircleShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected} keepAspectRatio>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <ellipse
          cx="50" cy="50" rx="48" ry="48"
          fill={data.bgColor || data.color || '#22c55e'}
          fillOpacity={0.15}
          stroke={data.color || '#22c55e'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const CircleShape = memo(CircleShapeInner);
