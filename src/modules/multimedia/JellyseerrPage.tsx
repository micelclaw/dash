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

import { ListPlus } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="jellyseerr" displayName="Jellyseerr" description="Media Requests" port={5055} icon={ListPlus} color="#a855f7" />;
}
