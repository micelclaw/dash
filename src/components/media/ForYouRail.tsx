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
import { MediaRail } from './MediaRail';
import { AI_MEDIA_ENABLED } from './flags';

interface ForYouRailProps {
  children?: ReactNode;
}

/**
 * Reserved affordance for the transversal AI phase: an AI-curated "For you"
 * rail (will wrap MediaRail with recommendations). Renders nothing while
 * AI_MEDIA_ENABLED is false.
 */
export function ForYouRail({ children }: ForYouRailProps) {
  if (!AI_MEDIA_ENABLED) return null;
  return <MediaRail title="For you">{children}</MediaRail>;
}
