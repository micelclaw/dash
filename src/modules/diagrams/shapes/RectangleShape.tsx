import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function RectangleShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect
          x="1" y="1" width="98" height="98"
          rx="4"
          fill={data.bgColor || data.color || '#3b82f6'}
          fillOpacity={0.15}
          stroke={data.color || '#3b82f6'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const RectangleShape = memo(RectangleShapeInner);
