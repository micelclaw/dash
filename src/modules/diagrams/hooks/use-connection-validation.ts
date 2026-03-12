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

import { useCallback } from 'react';
import type { Connection, Edge } from '@xyflow/react';

/**
 * Hook that provides connection validation logic.
 * - No self-connections
 * - No duplicate connections (same source→target)
 */
export function useConnectionValidation(edges: Edge[]) {
  const isValidConnection = useCallback(
    (connection: Connection): boolean => {
      // No self-connection
      if (connection.source === connection.target) return false;

      // No duplicate edges between same source and target
      const duplicate = edges.some(
        (e) =>
          (e.source === connection.source && e.target === connection.target) ||
          (e.source === connection.target && e.target === connection.source),
      );
      if (duplicate) return false;

      return true;
    },
    [edges],
  );

  return { isValidConnection };
}
