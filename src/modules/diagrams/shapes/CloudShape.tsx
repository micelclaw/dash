import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function CloudShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 120 80" preserveAspectRatio="none">
        <path
          d="M 30,65 Q 5,65 8,50 Q 2,40 15,30 Q 15,10 35,12 Q 45,0 60,8 Q 75,0 85,12 Q 105,10 105,30 Q 118,40 112,50 Q 115,65 90,65 Z"
          fill={data.bgColor || data.color || '#8b5cf6'}
          fillOpacity={0.15}
          stroke={data.color || '#8b5cf6'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const CloudShape = memo(CloudShapeInner);
