import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function DocumentShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M 2,2 L 98,2 L 98,80 Q 75,98 50,85 Q 25,72 2,90 Z"
          fill={data.bgColor || data.color || '#22c55e'}
          fillOpacity={0.15}
          stroke={data.color || '#22c55e'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const DocumentShape = memo(DocumentShapeInner);
