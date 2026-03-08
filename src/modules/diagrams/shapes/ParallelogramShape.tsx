import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function ParallelogramShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="18,2 98,2 82,98 2,98"
          fill={data.bgColor || data.color || '#f59e0b'}
          fillOpacity={0.15}
          stroke={data.color || '#f59e0b'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const ParallelogramShape = memo(ParallelogramShapeInner);
