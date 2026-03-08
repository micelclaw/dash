import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function PentagonShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="50,3 97,38 79,97 21,97 3,38"
          fill={data.bgColor || data.color || '#8b5cf6'}
          fillOpacity={0.15}
          stroke={data.color || '#8b5cf6'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const PentagonShape = memo(PentagonShapeInner);
