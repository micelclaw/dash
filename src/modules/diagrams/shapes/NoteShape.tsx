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

function NoteShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#eab308';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Note body with folded corner */}
        <path
          d="M 2,2 L 75,2 L 98,25 L 98,98 L 2,98 Z"
          fill={data.bgColor || color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth="2"
        />
        {/* Fold */}
        <path
          d="M 75,2 L 75,25 L 98,25"
          fill={color}
          fillOpacity={0.2}
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Text lines */}
        <line x1="12" y1="40" x2="85" y2="40" stroke={color} strokeWidth="1" strokeOpacity="0.25" />
        <line x1="12" y1="55" x2="80" y2="55" stroke={color} strokeWidth="1" strokeOpacity="0.25" />
        <line x1="12" y1="70" x2="70" y2="70" stroke={color} strokeWidth="1" strokeOpacity="0.25" />
      </svg>
    </BaseShape>
  );
}

export const NoteShape = memo(NoteShapeInner);
