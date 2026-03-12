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

import { Search } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="jackett" displayName="Jackett" description="Indexer Proxy" port={9117} icon={Search} color="#e74c3c" />;
}
