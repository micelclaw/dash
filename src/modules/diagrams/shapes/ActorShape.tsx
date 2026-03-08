import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function ActorShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#8b5cf6';
  return (
    <BaseShape data={data} selected={selected} keepAspectRatio>
      <svg width="100%" height="100%" viewBox="0 0 60 100" preserveAspectRatio="xMidYMid meet">
        {/* Head */}
        <circle cx="30" cy="18" r="12" fill="none" stroke={color} strokeWidth="2" />
        {/* Body */}
        <line x1="30" y1="30" x2="30" y2="65" stroke={color} strokeWidth="2" />
        {/* Arms */}
        <line x1="8" y1="45" x2="52" y2="45" stroke={color} strokeWidth="2" />
        {/* Left leg */}
        <line x1="30" y1="65" x2="12" y2="92" stroke={color} strokeWidth="2" />
        {/* Right leg */}
        <line x1="30" y1="65" x2="48" y2="92" stroke={color} strokeWidth="2" />
      </svg>
    </BaseShape>
  );
}

export const ActorShape = memo(ActorShapeInner);
