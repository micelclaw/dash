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

// ─── SectionShell (shared) ──────────────────────────────────────────
//
// Page-level wrapper for sections that follow the "gateway-config"
// pattern (read on mount, local dirty state, direct PATCH on save —
// no global SaveBar). Replaces the hand-rolled
// `<div maxWidth=700><div header><h2>...</h2><button save/></div></div>`
// scaffolding that was duplicated across ~14 sections (Sandbox,
// Browser, Commands, Cron, Hooks, Logging, Telemetry, Env, Secrets,
// MemorySearch, Session, GatewayAuth, ChannelBindings, Heartbeat).
//
// Provides:
//   - Consistent title + description header
//   - Optional inline Save button (with dirty / saving / blocked states)
//   - Optional secondary action slot in the header
//   - Loading state with default message (override via `loadingFallback`)
//   - Configurable max width (default 700px)
//
// Sections that use the global SaveBar pattern (settings.json) keep
// their existing scaffolding — they typically have multiple
// `<SettingSection>` cards inside instead of a single page-level header.

import { Save, RotateCw, Clock } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * When changes saved in this section actually take effect.
 *
 * - `instant`     → reflected on next request (default; no badge)
 * - `next-session`→ existing chat sessions keep old config; new ones
 *                   pick up the change. Render a clock pill.
 * - `gateway-restart` → values are read at OpenClaw boot; user must
 *                   restart Gateway to apply. Render an amber rotate
 *                   pill so the consequence is visible before save.
 */
export type AppliesAt = 'instant' | 'next-session' | 'gateway-restart';

const APPLIES_BADGES: Record<Exclude<AppliesAt, 'instant'>, {
  icon: typeof RotateCw;
  label: string;
  tooltip: string;
  color: string;
}> = {
  'gateway-restart': {
    icon: RotateCw,
    label: 'Restart required',
    tooltip: 'Changes take effect after the OpenClaw Gateway restarts.',
    color: 'var(--amber)',
  },
  'next-session': {
    icon: Clock,
    label: 'Applies to new sessions',
    tooltip: 'Existing sessions keep the old config; new ones pick up the change.',
    color: 'var(--text-muted)',
  },
};

export interface SectionShellProps {
  /** Section title rendered as <h2>. */
  title: string;
  /** Short description under the title. */
  description?: string;
  /** Children — usually rows / fields. */
  children: ReactNode;
  /**
   * Optional secondary action(s) rendered in the header to the LEFT
   * of the Save button. Use for things like "Reload", "View backups",
   * or per-section utility buttons.
   */
  headerAction?: ReactNode;

  // ── Loading state ────────────────────────────────────────────────
  /** When true, render the loading fallback instead of children. */
  loading?: boolean;
  /** Optional custom loading fallback. Defaults to "Loading...". */
  loadingFallback?: ReactNode;

  // ── Save controls ────────────────────────────────────────────────
  // Pass these together (or omit all) to enable the inline Save button.
  /** Whether the section has unsaved changes. */
  dirty?: boolean;
  /** Whether a save is in flight. */
  saving?: boolean;
  /** Save handler. If omitted, the Save button is not rendered. */
  onSave?: () => void;
  /**
   * If non-null, the Save button is rendered in disabled state with
   * this string as the `title` attribute. Use for validation blocks.
   */
  saveDisabledReason?: string | null;
  /** Override the default "Save" / "Saving..." / "Saved" labels. */
  saveLabel?: string;
  /**
   * When changes in this section actually take effect. Renders a small
   * pill next to the title for non-instant values so the consequence
   * is visible before the user clicks Save. Default: `instant`.
   */
  appliesAt?: AppliesAt;

  // ── Layout ───────────────────────────────────────────────────────
  /** Max width of the content column in px. Default 700. */
  maxWidth?: number;
}

export function SectionShell({
  title,
  description,
  children,
  headerAction,
  loading = false,
  loadingFallback,
  dirty,
  saving = false,
  onSave,
  saveDisabledReason,
  saveLabel,
  appliesAt = 'instant',
  maxWidth = 700,
}: SectionShellProps) {
  const showSaveButton = typeof onSave === 'function';
  const blocked = saveDisabledReason != null && saveDisabledReason !== '';
  const canSave = !!dirty && !saving && !blocked;
  const badge = appliesAt !== 'instant' ? APPLIES_BADGES[appliesAt] : null;

  return (
    <div style={{ maxWidth, fontFamily: 'var(--font-sans)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              {title}
            </h2>
            {badge && (
              <span
                title={badge.tooltip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: badge.color,
                  background: `color-mix(in srgb, ${badge.color} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${badge.color} 30%, transparent)`,
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  cursor: 'default',
                }}
              >
                <badge.icon size={11} />
                {badge.label}
              </span>
            )}
          </div>
          {description && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.8125rem',
                color: 'var(--text-dim)',
              }}
            >
              {description}
            </p>
          )}
        </div>

        {(headerAction || showSaveButton) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {headerAction}
            {showSaveButton && (
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                title={blocked ? saveDisabledReason ?? undefined : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background: canSave ? 'var(--amber)' : 'var(--surface)',
                  border: canSave ? 'none' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: canSave ? '#000' : 'var(--text-muted)',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  opacity: saving ? 0.7 : 1,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Save size={14} />
                {saveLabel ?? (saving ? 'Saving...' : dirty ? 'Save' : 'Saved')}
              </button>
            )}
          </div>
        )}
      </div>

      {loading
        ? loadingFallback ?? (
            <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>
          )
        : children}
    </div>
  );
}
