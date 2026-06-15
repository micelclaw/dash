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

import { Library } from 'lucide-react';
import { MultimediaEmbed } from '@/modules/multimedia/MultimediaEmbed';

/**
 * Manage tab (admin only): embedded Calibre-web for library curation.
 * Reuses the multimedia embed flow (install / start / iframe) directly —
 * MultimediaEmbed positions itself absolutely, hence the relative wrapper.
 */
export function ManageView() {
  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <MultimediaEmbed
        serviceName="calibreweb"
        displayName="Calibre-Web Automated"
        description="eBook library manager · upload + auto-ingest"
        port={8083}
        icon={Library}
        color="#8b5cf6"
      />
    </div>
  );
}
