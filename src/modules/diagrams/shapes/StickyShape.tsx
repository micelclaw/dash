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

function StickyShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#eab308';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M 2,2 L 98,2 L 98,82 L 82,98 L 2,98 Z"
          fill={data.bgColor || color}
          fillOpacity={0.2}
          stroke={color}
          strokeWidth="2"
        />
        {/* Folded corner */}
        <path
          d="M 82,98 L 82,82 L 98,82"
          fill={color}
          fillOpacity={0.3}
          stroke={color}
          strokeWidth="1.5"
        />
      </svg>
    </BaseShape>
  );
}

export const StickyShape = memo(StickyShapeInner);
