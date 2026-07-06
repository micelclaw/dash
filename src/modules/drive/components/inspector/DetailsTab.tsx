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

import { FileDetailsContent } from '@/components/shared/FileDetailsContent';
import type { FileRecord } from '@/types/files';

interface DetailsTabProps {
  file: FileRecord;
  /** Parent refetch (file lists) after a mutation. */
  onRefetch: () => void;
  /** Delete callback from the hosting view (moves to trash there). */
  onDelete?: (file: FileRecord) => void;
  /** Star toggle from the hosting view (so its list refreshes consistently). */
  onToggleStar?: (file: FileRecord, starred: boolean) => void;
}

/**
 * Drive inspector → Details tab. Thin wrapper over the shared
 * `FileDetailsContent` (vertical layout). The same content renders horizontally
 * in the File Explorer bottom panel. Activity/Versions are separate inspector
 * tabs, not part of this content.
 */
export function DetailsTab({ file, onRefetch, onDelete, onToggleStar }: DetailsTabProps) {
  return (
    <FileDetailsContent
      file={file}
      layout="vertical"
      onRefetch={onRefetch}
      onDelete={onDelete}
      onToggleStar={onToggleStar}
    />
  );
}
