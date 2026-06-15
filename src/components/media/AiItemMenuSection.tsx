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

import { Sparkles } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { AI_MEDIA_ENABLED } from './flags';

interface AiItemMenuSectionProps {
  itemLabel?: string;
}

/**
 * Reserved affordance for the transversal AI phase: an extra section for an
 * item's DropdownMenu (place inside MediaCard's `menu`). Renders nothing
 * while AI_MEDIA_ENABLED is false.
 */
export function AiItemMenuSection({ itemLabel }: AiItemMenuSectionProps) {
  if (!AI_MEDIA_ENABLED) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>
        <Sparkles size={14} style={{ marginRight: 6 }} />
        Ask AI{itemLabel ? ` about ${itemLabel}` : ''}
      </DropdownMenuItem>
    </>
  );
}
