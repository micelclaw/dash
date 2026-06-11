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

function ServerShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#3b82f6';
  return (
    <BaseShape data={data} selected={selected}>
      <svg width="100%" height="100%" viewBox="0 0 100 120" preserveAspectRatio="none">
        {/* Server rack */}
        <rect x="5" y="5" width="90" height="110" rx="5"
          fill={data.bgColor || color} fillOpacity={0.12}
          stroke={color} strokeWidth="2" />
        {/* Slots */}
        <rect x="12" y="15" width="76" height="25" rx="3"
          fill={color} fillOpacity={0.1} stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        <rect x="12" y="48" width="76" height="25" rx="3"
          fill={color} fillOpacity={0.1} stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        <rect x="12" y="81" width="76" height="25" rx="3"
          fill={color} fillOpacity={0.1} stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        {/* LEDs */}
        <circle cx="22" cy="27" r="3" fill={color} fillOpacity="0.5" />
        <circle cx="22" cy="60" r="3" fill={color} fillOpacity="0.5" />
        <circle cx="22" cy="93" r="3" fill={color} fillOpacity="0.5" />
      </svg>
    </BaseShape>
  );
}

export const ServerShape = memo(ServerShapeInner);
