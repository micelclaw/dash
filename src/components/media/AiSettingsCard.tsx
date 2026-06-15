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

import { Sparkles } from 'lucide-react';
import { AI_MEDIA_ENABLED } from './flags';

/**
 * Reserved affordance for the transversal AI phase: a settings card for the
 * media AI features (recommendations, semantic search, item Q&A). Renders
 * nothing while AI_MEDIA_ENABLED is false.
 */
export function AiSettingsCard() {
  if (!AI_MEDIA_ENABLED) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--card)',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.8125rem',
        color: 'var(--text-dim)',
      }}
    >
      <Sparkles size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
      AI media features
    </div>
  );
}
