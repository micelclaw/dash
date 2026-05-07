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

// ─── InlineLoading (shared) ─────────────────────────────────────────
//
// Tiny loading indicator for use inside `<SettingSection>` cards (the
// SaveBar-pattern sections that load multiple endpoints in parallel
// and want a per-card "Loading..." while each settles).
//
// `<SectionShell>` already provides a top-level loading fallback for
// gateway-config sections — this is the complementary atom for
// per-card loads (Energy power status, Network firewall, Account
// quota, etc.) where each card has its own fetch lifecycle.

import { Loader2 } from 'lucide-react';

export interface InlineLoadingProps {
  /** Visible text. Default "Loading...". */
  message?: string;
  /** Whether to show the spinning Loader2 icon next to the text. */
  withSpinner?: boolean;
}

export function InlineLoading({
  message = 'Loading...',
  withSpinner = false,
}: InlineLoadingProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '16px 0',
        color: 'var(--text-muted)',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {withSpinner && (
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
      )}
      {message}
    </div>
  );
}
