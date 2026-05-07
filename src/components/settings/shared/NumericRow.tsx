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

// ─── NumericRow (shared) ────────────────────────────────────────────
//
// Numeric input with clamp-on-blur and inline feedback. Replaces the
// `parseInt(e.target.value, 10) || fallback` pattern that was repeated
// across most numeric inputs in Settings — that pattern silently
// substituted the fallback when the user typed "0" or invalid input,
// confusing UX. This component:
//
//   - Lets the user type freely (string state internally)
//   - Validates against [min, max] live (red border + inline error)
//   - On blur or Enter: clamps to range, calls `onChange` with the
//     resulting integer. Shows a toast.info if the value was clamped
//     so the user knows their input was modified.
//
// Originally extracted from SandboxSection where it was first prototyped.

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export interface NumericRowProps {
  /** Visible label, shown to the left. */
  label: string;
  /** Optional secondary text under the label. */
  description?: string;
  /** Current committed value (parent-owned). */
  value: number;
  /** Inclusive minimum. */
  min: number;
  /** Inclusive maximum. */
  max: number;
  /** Called with the clamped integer when the user commits (blur or Enter). */
  onChange: (v: number) => void;
  /** Optional unit suffix shown next to the input (e.g. "ms", "min"). */
  unit?: string;
  /** Width of the input in px. Default 60 (or 80 if `unit` is set). */
  inputWidth?: number;
  /** Disable the input. */
  disabled?: boolean;
  /**
   * Layout. `row` (default): label left, input right, single line.
   * `stacked`: label on top, input below — useful when the label is long.
   */
  layout?: 'row' | 'stacked';
}

export function NumericRow({
  label,
  description,
  value,
  min,
  max,
  onChange,
  unit,
  inputWidth,
  disabled = false,
  layout = 'row',
}: NumericRowProps) {
  const [text, setText] = useState(String(value));

  // Sync internal text with external value changes (e.g. fetch / reset).
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const parsed = parseInt(text, 10);
  const invalid = text.length > 0 && (Number.isNaN(parsed) || parsed < min || parsed > max);
  const width = inputWidth ?? (unit ? 80 : 60);

  const commit = () => {
    if (Number.isNaN(parsed)) {
      // Restore last known good value
      setText(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    if (clamped !== parsed) {
      toast.info(`${label}: clamped to ${clamped} (range ${min}–${max})`);
    }
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  const inputEl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        value={text}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        style={{
          padding: '4px 8px',
          fontSize: '0.75rem',
          width,
          textAlign: 'right',
          background: 'var(--surface)',
          border: `1px solid ${invalid ? '#ef4444' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text)',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
      />
      {unit && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          {unit}
        </span>
      )}
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{label}</div>
          {description && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              {description}
            </div>
          )}
        </div>
        {inputEl}
        {invalid && (
          <span style={{ fontSize: '0.6875rem', color: '#ef4444', fontFamily: 'var(--font-sans)' }}>
            ! Must be between {min} and {max}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{label}</div>
          {description && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              {description}
            </div>
          )}
        </div>
        {inputEl}
      </div>
      {invalid && (
        <span style={{ fontSize: '0.6875rem', color: '#ef4444', textAlign: 'right', fontFamily: 'var(--font-sans)' }}>
          ! Must be between {min} and {max}
        </span>
      )}
    </div>
  );
}
