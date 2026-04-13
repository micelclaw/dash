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

// ─── SafetyScannerReport — display Phase 10 scan results ────────────

import { Check, X, AlertTriangle, Shield } from 'lucide-react';
import type { StudioScanResult } from '@/stores/studio.store';

interface Props {
  result: StudioScanResult;
}

export function SafetyScannerReport({ result }: Props) {
  const ok = result.passed;
  const color = ok ? '#22c55e' : 'var(--danger)';

  return (
    <div style={{
      padding: 12,
      background: 'var(--card)',
      border: `1px solid ${ok ? 'color-mix(in srgb, #22c55e 40%, var(--border))' : 'color-mix(in srgb, var(--danger) 40%, var(--border))'}`,
      borderLeft: `2px solid ${color}`,
      borderRadius: 'var(--radius-sm)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shield size={14} style={{ color }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
          Safety Scanner — {result.level}
        </span>
        <span style={{
          padding: '1px 8px',
          background: `${color}22`, color,
          borderRadius: 'var(--radius-full)',
          fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase',
        }}>
          {ok ? 'pasado' : 'bloqueado'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: 'var(--text-muted)' }}>
          {result.errors.length}E / {result.warnings.length}W
        </span>
      </div>

      {result.errors.length === 0 && result.warnings.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: '0.6875rem' }}>
          <Check size={11} style={{ color: '#22c55e' }} /> Sin issues. Listo para empaquetar.
        </div>
      )}

      {result.errors.map((e, idx) => (
        <IssueRow key={`e-${idx}`} icon={<X size={11} style={{ color: 'var(--danger)' }} />} issue={e} />
      ))}
      {result.warnings.map((w, idx) => (
        <IssueRow key={`w-${idx}`} icon={<AlertTriangle size={11} style={{ color: 'var(--amber)' }} />} issue={w} />
      ))}
    </div>
  );
}

function IssueRow({ icon, issue }: { icon: React.ReactNode; issue: { code: string; message: string; detail?: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.6875rem' }}>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <code style={{
            fontSize: '0.625rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>{issue.code}</code>
          <span style={{ color: 'var(--text)' }}>{issue.message}</span>
        </div>
        {issue.detail && (
          <div style={{ marginTop: 2, color: 'var(--text-dim)', fontSize: '0.625rem' }}>
            {issue.detail}
          </div>
        )}
      </div>
    </div>
  );
}
