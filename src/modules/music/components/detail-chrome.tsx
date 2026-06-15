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

import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Small "← Back" link used at the top of detail views. */
export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
        color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
      }}
    >
      <ArrowLeft size={14} /> {label}
    </button>
  );
}

/** Pill action button for MediaHero actions (Play all / Shuffle). */
export function HeroActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 18px', borderRadius: 999, fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)', cursor: 'pointer',
        border: primary ? 'none' : '1px solid var(--border)',
        background: primary ? 'var(--amber)' : 'transparent',
        color: primary ? '#06060a' : 'var(--text-dim)',
        fontWeight: primary ? 600 : 400,
        transition: 'background var(--transition-fast)',
      }}
    >
      <Icon size={14} fill={primary ? 'currentColor' : 'none'} /> {label}
    </button>
  );
}
