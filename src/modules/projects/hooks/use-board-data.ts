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
