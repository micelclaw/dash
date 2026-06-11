/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseShape } from './BaseShape';
import type { DiagramNodeData } from '../types';

function CylinderShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#3b82f6';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M 2,15 Q 2,2 50,2 Q 98,2 98,15 L 98,85 Q 98,98 50,98 Q 2,98 2,85 Z"
          fill={data.bgColor || color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth="2"
        />
        <ellipse
          cx="50" cy="15" rx="48" ry="13"
          fill={data.bgColor || color}
          fillOpacity={0.1}
          stroke={color}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const CylinderShape = memo(CylinderShapeInner);
