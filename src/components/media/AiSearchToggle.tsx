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

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AI_MEDIA_ENABLED } from './flags';

interface AiSearchToggleProps {
  active?: boolean;
  onToggle?: () => void;
}

/**
 * Reserved affordance for the transversal AI phase: a sparkle toggle that
 * switches the media search into AI/semantic mode. Renders nothing while
 * AI_MEDIA_ENABLED is false.
 */
export function AiSearchToggle({ active = false, onToggle }: AiSearchToggleProps) {
  const [hovered, setHovered] = useState(false);
  if (!AI_MEDIA_ENABLED) return null;

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="AI search"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        flexShrink: 0,
        color: active ? 'var(--amber)' : hovered ? 'var(--text)' : 'var(--text-muted)',
        transition: 'color var(--transition-fast)',
      }}
    >
      <Sparkles size={14} />
    </button>
  );
}
