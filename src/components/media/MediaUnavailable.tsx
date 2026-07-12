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

import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

interface MediaUnavailableProps {
  icon: LucideIcon;
  /** Container display name, e.g. "Jellyfin". */
  serviceName: string;
  /** Lowercase noun for what it serves, e.g. "movies and series", "music". */
  mediaNoun: string;
  /** Container is installed (may still be stopped). */
  installed: boolean;
  /** On-demand start currently in progress. */
  starting: boolean;
  /** Last start error, or null. */
  startError?: string | null;
  /** Kick off the on-demand start. */
  onStart: () => void;
  /** Re-check status (e.g. after an admin installs the container). */
  onRetry: () => void;
}

/**
 * Shared "media service not usable" panel for the Video/Music/Books modules.
 * Three states, all self-service — a non-admin NEVER gets sent to the
 * admin-only Servarr module (which would bounce them to /chat):
 *
 *  - starting          → live spinner + elapsed seconds (the container boots
 *                        on-demand; the module flips to content the moment it
 *                        is running, no need to leave and come back).
 *  - not installed     → friendly note to ask an admin to install it from
 *                        Servarr (no action a user can take; just Retry).
 *  - installed+stopped → a "Start" button (the module auto-starts on entry,
 *                        so this is the manual fallback after a failed/timed-
 *                        out auto-start).
 */
export function MediaUnavailable({
  icon,
  serviceName,
  mediaNoun,
  installed,
  starting,
  startError,
  onStart,
  onRetry,
}: MediaUnavailableProps) {
  // Elapsed-seconds ticker, alive only while starting.
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number>(0);
  useEffect(() => {
    if (!starting) return;
    startedAt.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [starting]);

  if (starting) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', gap: 14, textAlign: 'center', padding: 32, color: 'var(--text-dim)',
        }}
      >
        <Loader2 size={40} style={{ animation: 'mu-spin 1s linear infinite', color: 'var(--amber)' }} />
        <div style={{ fontSize: '1.0625rem', fontWeight: 500, color: 'var(--text)' }}>
          Starting {serviceName}…
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Your {mediaNoun} will appear as soon as it’s ready · {elapsed}s
        </div>
        <style>{`@keyframes mu-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!installed) {
    return (
      <EmptyState
        icon={icon}
        title={`${serviceName} is not installed`}
        description={`${serviceName} serves your ${mediaNoun}. Ask an administrator to install it from the Servarr module — it’ll appear here automatically once installed.`}
        actions={[{ label: 'Check again', onClick: onRetry, variant: 'secondary' }]}
      />
    );
  }

  // Installed but not running (auto-start failed or timed out) → manual start.
  return (
    <EmptyState
      icon={icon}
      title={`${serviceName} is not running`}
      description={startError ?? `${serviceName} serves your ${mediaNoun}. Start it to continue.`}
      actions={[
        { label: `Start ${serviceName}`, onClick: onStart, variant: 'primary' },
        { label: 'Check again', onClick: onRetry, variant: 'secondary' },
      ]}
    />
  );
}
