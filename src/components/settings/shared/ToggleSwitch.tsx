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

// ─── ToggleSwitch (shared) ──────────────────────────────────────────
//
// Accessible on/off switch that replaces the hand-rolled `<div onClick>`
// toggles duplicated across ~9 gateway-config sections (Cron, Hooks,
// MemorySearch, Secrets, Session, Telemetry, ChannelBindings, etc.).
//
// Built as a real `<button role="switch">` so it:
//   - Is reachable by keyboard (Tab moves focus to it)
//   - Is activated by Space and Enter
//   - Announces correctly in screen readers (aria-checked + role)
//   - Has a visible focus ring (outline) for keyboard users
//
// Visual identical to the previous div-based toggle — same dimensions,
// same colors, same animation. Drop-in replacement.
//
// This is the *atom*; sections that need a "row with label + description
// + toggle" wrap it in their own row layout, or use the existing
// `<SettingToggle>` (which is the row variant for SaveBar sections).

import type { CSSProperties } from 'react';

export interface ToggleSwitchProps {
  /** Whether the switch is on. */
  checked: boolean;
  /** Called with the new value. */
  onChange: (value: boolean) => void;
  /** When true, the switch is greyed out and ignores input. */
  disabled?: boolean;
  /**
   * Accessible label. Required if there is no associated `<label>`
   * element pointing at this switch — otherwise screen readers would
   * announce "switch, on" with no context.
   */
  ariaLabel?: string;
  /** Optional extra styles. */
  style?: CSSProperties;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  style,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--success, #22c55e)' : 'var(--text-muted)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.2s',
        border: 'none',
        padding: 0,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          transition: 'left 0.2s',
          display: 'block',
        }}
      />
    </button>
  );
}
