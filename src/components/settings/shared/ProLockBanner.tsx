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

// ─── ProLockBanner (shared) ─────────────────────────────────────────
//
// Amber banner shown at the top of a Pro-gated section. Renders only
// when `isPro` is false. Replaces the copy-pasted block that was
// duplicated between PhotosSection and StorageSection (File Snapshots).
//
// Pair with `<ProGate>` (or pass `disabled={!isPro}` manually) to
// actually disable the controls underneath. The banner alone is just
// information — it does not gate input.

import { Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const PRICING_URL = 'https://micelclaw.com/pricing';

export interface ProLockBannerProps {
  /**
   * Short description of what the user unlocks. Shown after the
   * "Pro feature" prefix. E.g. "Face recognition, semantic search,
   * and automatic descriptions for your photos."
   */
  description: string;
  /**
   * Optional override of the upgrade URL. Defaults to micelclaw.com/pricing.
   */
  upgradeUrl?: string;
}

export function ProLockBanner({
  description,
  upgradeUrl = PRICING_URL,
}: ProLockBannerProps) {
  const tier = useAuthStore((s) => s.user?.tier ?? 'free');
  if (tier === 'pro') return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        marginBottom: 12,
        background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--amber)',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, lineHeight: 1.5 }}>
        <strong>Pro feature</strong> — {description}{' '}
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noopener"
          style={{ color: 'var(--amber)', textDecoration: 'underline' }}
        >
          Upgrade
        </a>
      </div>
    </div>
  );
}

/**
 * `useIsPro()` — convenience hook used by sections that need to pass
 * `disabled={!isPro}` to controls outside a `<ProGate>`. Sections that
 * own their disable logic (e.g. SettingToggle, SettingSelect that
 * accept a `disabled` prop) prefer this to wrapping the children.
 */
export function useIsPro(): boolean {
  return useAuthStore((s) => s.user?.tier ?? 'free') === 'pro';
}
