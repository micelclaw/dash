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

// ─── Voice Button ───────────────────────────────────────────────────
// Push-to-talk button for the Chat input area.
// States: idle (mic icon) → recording (pulsing red) → processing (spinner)

import { useCallback } from 'react';
import { Mic, Loader2, Square } from 'lucide-react';
import type { VoiceState } from '@/hooks/use-voice';

interface VoiceButtonProps {
  state: VoiceState;
  duration: number;
  onStart: () => void;
  onStop: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceButton({ state, duration, onStart, onStop }: VoiceButtonProps) {
  const handleClick = useCallback(() => {
    if (state === 'recording') {
      onStop();
    } else if (state === 'idle') {
      onStart();
    }
  }, [state, onStart, onStop]);

  if (state === 'processing') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-hover)',
          color: 'var(--text-dim)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Transcribing...
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <button
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: '#ef4444',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ef4444',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        {formatDuration(duration)}
        <Square size={12} fill="#ef4444" />
      </button>
    );
  }

  // Idle
  return (
    <button
      onClick={handleClick}
      title="Push to talk"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        padding: 4,
        display: 'flex',
        borderRadius: 'var(--radius-sm)',
        transition: 'color var(--transition-fast)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
      <Mic size={16} />
    </button>
  );
}
