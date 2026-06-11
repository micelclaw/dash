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

function Database3dShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#3b82f6';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 120" preserveAspectRatio="none">
        {/* Body */}
        <path
          d="M 5,25 L 5,95 Q 5,115 50,115 Q 95,115 95,95 L 95,25"
          fill={data.bgColor || color}
          fillOpacity={0.12}
          stroke={color}
          strokeWidth="2"
        />
        {/* Top ellipse */}
        <ellipse cx="50" cy="25" rx="45" ry="20"
          fill={data.bgColor || color} fillOpacity={0.15}
          stroke={color} strokeWidth="2" />
        {/* Middle ring */}
        <path d="M 5,55 Q 5,70 50,70 Q 95,70 95,55"
          fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      </svg>
    </BaseShape>
  );
}

export const Database3dShape = memo(Database3dShapeInner);
