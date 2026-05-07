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

// ─── RetryBanner (shared) ───────────────────────────────────────────
//
// Inline error/warning banner with a Retry button. Replaces the
// hand-rolled banners that were duplicated across:
//   - EnergySection (PowerStatus, UPS — error fetching status)
//   - SensorFusionSection (HA status fetch failure)
//   - RawConfigPage (schema-load error)
//   - DuplicatesSection (scan failure)
//   - NetworkSection (VPN / Proxy fetch failure)
//
// Two visual severities ("warn" amber, "error" red), a single message,
// and an optional Retry handler. Loading state on the button avoids
// double-clicks while the retry is in flight.

import { AlertTriangle, RefreshCw } from 'lucide-react';

export type RetryBannerSeverity = 'warn' | 'error';

export interface RetryBannerProps {
  /** Visual severity. `warn` = amber (degraded but operational), `error` = red (broken). */
  severity?: RetryBannerSeverity;
  /** Body text shown next to the icon. */
  message: string;
  /** Optional bold prefix (e.g. "Schema unavailable", "Power monitoring offline"). */
  title?: string;
  /** Called when the user clicks Retry. If omitted, the button is hidden. */
  onRetry?: () => void;
  /** When true, the Retry button shows a spinning icon and is disabled. */
  loading?: boolean;
  /**
   * Layout. `inline` (default) is a full-width card suitable inside a
   * section. `compact` is a denser one-line variant for footers /
   * inline status rows (used by SensorFusion next to the Status label).
   */
  layout?: 'inline' | 'compact';
}

export function RetryBanner({
  severity = 'warn',
  message,
  title,
  onRetry,
  loading = false,
  layout = 'inline',
}: RetryBannerProps) {
  const colors = severity === 'error'
    ? { fg: '#ef4444', bg: '#ef444415', border: '#ef444440' }
    : { fg: 'var(--amber)', bg: 'var(--surface)', border: 'var(--border)' };

  if (layout === 'compact') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.75rem', color: colors.fg,
          fontFamily: 'var(--font-sans)',
        }}>
          <AlertTriangle size={13} />
          {title && <strong>{title}</strong>}
          {title && message ? ' · ' : ''}
          {message}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={loading}
            title="Retry"
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--text-dim)', height: 22, padding: '0 8px',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw
              size={11}
              style={loading ? { animation: 'spin 1s linear infinite' } : undefined}
            />
            {loading ? 'Loading…' : 'Retry'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        color: severity === 'error' ? colors.fg : 'var(--text-muted)',
        fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
        flex: 1,
      }}>
        <AlertTriangle size={14} style={{ color: colors.fg, flexShrink: 0 }} />
        <span>
          {title && <strong style={{ color: colors.fg }}>{title}</strong>}
          {title ? ' · ' : ''}
          {message}
        </span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={loading}
          style={{
            height: 28, padding: '0 12px',
            background: 'var(--surface)',
            border: `1px solid ${severity === 'error' ? colors.fg : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            color: severity === 'error' ? colors.fg : 'var(--text)',
            fontSize: '0.75rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-sans)',
            opacity: loading ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <RefreshCw
            size={12}
            style={loading ? { animation: 'spin 1s linear infinite' } : undefined}
          />
          {loading ? 'Loading…' : 'Retry'}
        </button>
      )}
    </div>
  );
}
