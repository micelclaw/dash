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
