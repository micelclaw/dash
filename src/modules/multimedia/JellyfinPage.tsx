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

import { Clapperboard } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="jellyfin" displayName="Jellyfin" description="Media Server" port={8096} icon={Clapperboard} color="#a855f7" />;
}
