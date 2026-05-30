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
import { createPortal } from 'react-dom';

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
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const display = value || fallback;

  // Capture anchor position when opening so the portal-rendered popover
  // can position itself with `position: fixed`.
  useEffect(() => {
    if (!open) { setAnchorRect(null); return; }
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (popoverRef.current && popoverRef.current.contains(target)) ||
        (triggerRef.current && triggerRef.current.contains(target))
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Compute popover position from anchor rect. Place below by default;
  // flip to above if there's not enough room. Clamp horizontally to the
  // viewport so it never gets cut off near the right edge.
  const POPOVER_WIDTH = 336;
  const POPOVER_HEIGHT_ESTIMATE = 320;
  let popoverTop = 0;
  let popoverLeft = 0;
  if (anchorRect) {
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - anchorRect.bottom;
    const goesUp = spaceBelow < POPOVER_HEIGHT_ESTIMATE && anchorRect.top > spaceBelow;
    popoverTop = goesUp
      ? Math.max(8, anchorRect.top - POPOVER_HEIGHT_ESTIMATE - 8)
      : anchorRect.bottom + 8;
    popoverLeft = Math.min(
      Math.max(8, anchorRect.left),
      viewportW - POPOVER_WIDTH - 8,
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
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
      {open && anchorRect && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: popoverTop,
            left: popoverLeft,
            background: 'rgba(24, 24, 27, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.4))',
            padding: 14,
            zIndex: 9999,
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 6,
            width: POPOVER_WIDTH,
          }}
        >
          {AVATAR_EMOJIS.map(emoji => (
            <span
              key={emoji}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              style={{
                width: 46,
                height: 46,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
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
        </div>,
        document.body,
      )}
    </>
  );
}
