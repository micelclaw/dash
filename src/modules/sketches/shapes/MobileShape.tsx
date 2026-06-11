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

function MobileShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#6b7280';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 60 100" preserveAspectRatio="none">
        {/* Phone body */}
        <rect x="5" y="3" width="50" height="94" rx="8"
          fill={data.bgColor || color} fillOpacity={0.12}
          stroke={color} strokeWidth="2" />
        {/* Screen */}
        <rect x="9" y="14" width="42" height="72" rx="2"
          fill={color} fillOpacity={0.06} />
        {/* Notch */}
        <rect x="20" y="6" width="20" height="4" rx="2"
          fill={color} fillOpacity={0.2} />
        {/* Home indicator */}
        <rect x="20" y="91" width="20" height="3" rx="1.5"
          fill={color} fillOpacity={0.2} />
      </svg>
    </BaseShape>
  );
}

export const MobileShape = memo(MobileShapeInner);
