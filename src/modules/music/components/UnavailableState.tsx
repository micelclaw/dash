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
import { Music } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMusicStore } from '@/stores/music.store';

/** Shown when Navidrome is not installed or not running (503 from Core). */
export function UnavailableState() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Music}
      title="Navidrome is not running"
      description="The music library is served by Navidrome. Start it from the Servarr module, then come back here."
      actions={[
        { label: 'Open Servarr', onClick: () => navigate('/multimedia'), variant: 'primary' },
        {
          label: 'Retry',
          onClick: () => {
            const store = useMusicStore.getState();
            void store.checkStatus().then(() => {
              if (!useMusicStore.getState().unavailable) void store.loadHome();
            });
          },
          variant: 'secondary',
        },
      ]}
    />
  );
}
