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

function RoundedShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect
          x="1" y="1" width="98" height="98"
          rx="16"
          fill={data.bgColor || data.color || '#3b82f6'}
          fillOpacity={0.15}
          stroke={data.color || '#3b82f6'}
          strokeWidth="2"
        />
      </svg>
    </BaseShape>
  );
}

export const RoundedShape = memo(RoundedShapeInner);
