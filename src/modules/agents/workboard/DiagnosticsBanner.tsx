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

import { AlertTriangle } from 'lucide-react';
import type { WorkboardDiagnostic } from './types';

const KIND_LABEL: Record<string, string> = {
  stranded_ready: 'lista sin reclamar',
  running_without_heartbeat: 'en curso sin heartbeat',
  blocked_too_long: 'bloqueada demasiado tiempo',
  repeated_failures: 'fallos repetidos',
  missing_proof: 'falta proof',
  orphaned_session: 'sesión huérfana',
};

export function DiagnosticsBanner({ diagnostics }: { diagnostics: WorkboardDiagnostic[] }) {
  if (!diagnostics || diagnostics.length === 0) return null;
  const worst = diagnostics.some((d) => d.severity === 'critical' || d.severity === 'error');
  const color = worst ? 'var(--red, #ef4444)' : 'var(--amber)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, marginBottom: 10,
      border: `1px solid ${color}`, background: 'var(--bg-subtle, rgba(239,68,68,0.06))', fontSize: '0.75rem', color: 'var(--text)',
    }}>
      <AlertTriangle size={14} style={{ color, flexShrink: 0 }} />
      <span style={{ color: 'var(--text-dim)' }}>
        {diagnostics.length} {diagnostics.length === 1 ? 'aviso' : 'avisos'}:{' '}
        {diagnostics.slice(0, 3).map((d) => KIND_LABEL[d.kind] ?? d.kind).join(' · ')}
        {diagnostics.length > 3 ? ` · +${diagnostics.length - 3}` : ''}
      </span>
    </div>
  );
}
