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

import { useState, useEffect } from 'react';
import { ListPlus } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';
import { JellyseerrOnboarding } from './JellyseerrOnboarding';

export function Component() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Detect if Jellyseerr needs initial setup
  useEffect(() => {
    (async () => {
      try {
        const hostname = window.location.hostname;
        const res = await fetch(
          `${window.location.protocol}//${hostname}:5055/api/v1/settings/public`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (res.ok) {
          const data = await res.json() as { initialized?: boolean };
          if (!data.initialized) setShowOnboarding(true);
        } else {
          setShowOnboarding(true);
        }
      } catch {
        // API not reachable yet — show onboarding once iframe loads
        setShowOnboarding(true);
      }
    })();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MultimediaEmbed
        serviceName="jellyseerr"
        displayName="Jellyseerr"
        description="Media Requests"
        port={5055}
        icon={ListPlus}
        color="#a855f7"
      />
      <JellyseerrOnboarding
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
