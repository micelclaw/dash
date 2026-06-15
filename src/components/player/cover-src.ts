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

import type { PlayableItem } from '@/stores/player.store';

/**
 * Resolve the cover art source for a playable item: coverUrl (media-server /
 * VFS preview URL) wins over the legacy inline coverBase64.
 */
export function coverSrc(
  item: Pick<PlayableItem, 'coverUrl' | 'coverBase64'>,
): string | null {
  return item.coverUrl || item.coverBase64 || null;
}
