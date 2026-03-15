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

// ─── Speaking Indicator ─────────────────────────────────────────────
// Shows when TTS is playing back with animated speaker waves.

import { Volume2, Square } from 'lucide-react';

interface SpeakingIndicatorProps {
  onStop: () => void;
}

export function SpeakingIndicator({ onStop }: SpeakingIndicatorProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'rgba(59, 130, 246, 0.12)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: 'var(--radius-md)',
        color: '#3b82f6',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Volume2 size={14} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
      Speaking...
      <button
        onClick={onStop}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#3b82f6',
          padding: 0,
          display: 'flex',
        }}
      >
        <Square size={12} fill="#3b82f6" />
      </button>
    </div>
  );
}
