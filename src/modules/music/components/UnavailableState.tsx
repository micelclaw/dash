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

import { Music } from 'lucide-react';
import { MediaUnavailable } from '@/components/media';
import { useMusicStore } from '@/stores/music.store';

/**
 * Shown when Navidrome is not installed, not running, or starting on-demand.
 * A user with Music access NEVER gets redirected to the admin-only Servarr
 * module — the container starts here (auto on entry; button as fallback).
 */
export function UnavailableState() {
  const installed = useMusicStore((s) => s.installed);
  const starting = useMusicStore((s) => s.starting);
  const startError = useMusicStore((s) => s.startError);
  return (
    <MediaUnavailable
      icon={Music}
      serviceName="Navidrome"
      mediaNoun="music"
      installed={installed}
      starting={starting}
      startError={startError}
      onStart={() => void useMusicStore.getState().startAndWait()}
      onRetry={() => void useMusicStore.getState().ensureRunning()}
    />
  );
}
