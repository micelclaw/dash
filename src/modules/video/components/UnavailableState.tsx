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
import { MediaUnavailable } from '@/components/media';
import { useVideoStore } from '@/stores/video.store';

/**
 * Shown when Jellyfin is not installed, not running, or starting on-demand.
 * A user with Video access NEVER gets redirected to the admin-only Servarr
 * module — the container starts here (auto on entry; button as fallback).
 */
export function UnavailableState() {
  const installed = useVideoStore((s) => s.installed);
  const starting = useVideoStore((s) => s.starting);
  const startError = useVideoStore((s) => s.startError);
  return (
    <MediaUnavailable
      icon={Clapperboard}
      serviceName="Jellyfin"
      mediaNoun="movies and series"
      installed={installed}
      starting={starting}
      startError={startError}
      onStart={() => void useVideoStore.getState().startAndWait()}
      onRetry={() => void useVideoStore.getState().ensureRunning()}
    />
  );
}
