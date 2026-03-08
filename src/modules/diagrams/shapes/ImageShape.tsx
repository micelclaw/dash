import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function ImageShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect
          x="1" y="1" width="98" height="98"
          rx="6"
          fill={data.bgColor || data.color || '#ec4899'}
          fillOpacity={0.1}
          stroke={data.color || '#ec4899'}
          strokeWidth="2"
        />
        {/* Image icon placeholder */}
        <rect x="25" y="25" width="50" height="40" rx="3" fill="none" stroke={data.color || '#ec4899'} strokeWidth="1.5" strokeOpacity={0.5} />
        <circle cx="38" cy="38" r="5" fill={data.color || '#ec4899'} fillOpacity={0.4} />
        <polyline points="30,58 42,48 55,55 62,50 70,58" fill="none" stroke={data.color || '#ec4899'} strokeWidth="1.5" strokeOpacity={0.5} />
      </svg>
    </BaseShape>
  );
}

export const ImageShape = memo(ImageShapeInner);
