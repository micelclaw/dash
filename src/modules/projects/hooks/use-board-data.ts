import { useEffect } from 'react';
import { useProjectsStore } from '@/stores/projects.store';

/**
 * Load and subscribe to a board's data.
 * Call this at the top of BoardView with the current boardId.
 */
export function useBoardData(boardId: string | undefined) {
  const fetchFullBoard = useProjectsStore((s) => s.fetchFullBoard);
  const boardLoading = useProjectsStore((s) => s.boardLoading);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);

  useEffect(() => {
    if (boardId && boardId !== activeBoardId) {
      fetchFullBoard(boardId);
    }
  }, [boardId, activeBoardId, fetchFullBoard]);

  return { loading: boardLoading };
}
