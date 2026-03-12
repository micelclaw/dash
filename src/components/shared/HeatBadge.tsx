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

import { getHeatTier, HEAT_COLORS } from '@/types/intelligence';

interface HeatBadgeProps {
  score: number;
  size?: number;
}

export function HeatBadge({ score, size = 8 }: HeatBadgeProps) {
  if (!score || score <= 0) return null;

  const tier = getHeatTier(score);
  const color = HEAT_COLORS[tier];

  return (
    <span
      title={`Heat: ${(score * 100).toFixed(0)}% (${tier})`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}
