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

import { useNavigate } from 'react-router';
import { Clapperboard } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { useVideoStore } from '@/stores/video.store';

/** Shown when Jellyfin is not installed or not running (503 from Core). */
export function UnavailableState() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Clapperboard}
      title="Jellyfin is not running"
      description="Movies and series are served by Jellyfin. Start it from the Servarr module, then come back here."
      actions={[
        { label: 'Open Servarr', onClick: () => navigate('/multimedia'), variant: 'primary' },
        {
          label: 'Retry',
          onClick: () => {
            const store = useVideoStore.getState();
            void store.checkStatus().then(() => {
              if (!useVideoStore.getState().unavailable) void store.loadHome();
            });
          },
          variant: 'secondary',
        },
      ]}
    />
  );
}
