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

// G9: shared emoji avatar picker. Used by AgentDetail (per-agent) and
// UserAvatarButton (per-user). The 30 emojis are the canonical set —
// adding a new one here propagates everywhere.

import { useEffect, useRef, useState } from 'react';

export const AVATAR_EMOJIS = [
  '🤖', '🧪', '📊', '📧', '📅', '🎯', '💼', '🛡️', '🎨', '💰',
  '🧬', '🏠', '📂', '🐙', '🔍', '⚡', '🌐', '🧠', '🔬', '📡',
  '🎭', '🦊', '🐺', '🦉', '🐋', '🦅', '🔮', '💎', '🚀', '⭐',
] as const;

export type AvatarEmoji = (typeof AVATAR_EMOJIS)[number] | string;

interface EmojiAvatarPickerProps {
  /** Currently selected emoji. */
  value: string | null | undefined;
  /** Called with the new emoji when the user picks one. */
  onChange: (emoji: string) => void;
  /** Avatar pixel size for the trigger. Default 24. */
  size?: number;
  /** Fallback emoji when value is empty. Default '🤖'. */
  fallback?: string;
  /** Color of the ring around the trigger (uses currentColor by default). */
  ringColor?: string;
  /** Tooltip on the trigger. */
  title?: string;
}

export function EmojiAvatarPicker({
  value,
  onChange,
  size = 24,
  fallback = '🤖',
  ringColor,
  title = 'Change avatar',
}: EmojiAvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const display = value || fallback;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={pickerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={title}
        aria-label={title}
        style={{
          width: size,
          height: size,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.7),
          lineHeight: 1,
          cursor: 'pointer',
          borderRadius: '50%',
          background: 'transparent',
          border: ringColor ? `1px solid ${ringColor}` : '1px solid var(--border)',
          color: 'inherit',
        }}
      >
        {display}
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 6,
          background: 'rgba(24, 24, 27, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.4))',
          padding: 10,
          zIndex: 1000,
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
          minWidth: 200,
        }}>
          {AVATAR_EMOJIS.map(emoji => (
            <span
              key={emoji}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              style={{
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.125rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                border: emoji === value ? '1px solid var(--amber)' : '1px solid transparent',
                background: emoji === value ? 'var(--surface-hover)' : 'transparent',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { if (emoji !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
