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

function QueueShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#06b6d4';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 70" preserveAspectRatio="none">
        <rect
          x="2" y="2" width="96" height="66" rx="4"
          fill={data.bgColor || color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth="2"
        />
        {/* Queue dividers */}
        <line x1="33" y1="2" x2="33" y2="68" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        <line x1="66" y1="2" x2="66" y2="68" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        {/* Arrow */}
        <path d="M 8,35 L 92,35" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
        <path d="M 86,30 L 92,35 L 86,40" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
      </svg>
    </BaseShape>
  );
}

export const QueueShape = memo(QueueShapeInner);
