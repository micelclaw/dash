import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function HexagonShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="25,2 75,2 98,50 75,98 25,98 2,50"
          fill={data.bgColor || data.color || '#8b5cf6'}
          fillOpacity={0.15}
          stroke={data.color || '#8b5cf6'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const HexagonShape = memo(HexagonShapeInner);
