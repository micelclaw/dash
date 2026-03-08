import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function TrapezoidShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="20,5 80,5 98,95 2,95"
          fill={data.bgColor || data.color || '#f59e0b'}
          fillOpacity={0.15}
          stroke={data.color || '#f59e0b'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const TrapezoidShape = memo(TrapezoidShapeInner);
