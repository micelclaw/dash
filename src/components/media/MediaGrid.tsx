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

import type { ReactNode } from 'react';

interface MediaGridProps {
  children: ReactNode;
  /** Min card width in px (default 160). */
  min?: number;
  /** Grid gap in px (default 16). */
  gap?: number;
}

/**
 * Responsive auto-fill grid for MediaCards. No virtualization in MVP.
 */
export function MediaGrid({ children, min = 160, gap = 16 }: MediaGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  );
}
