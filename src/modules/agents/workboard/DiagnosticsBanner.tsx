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
import { hasMessage, useI18n } from '@/i18n';
import type { WorkboardDiagnostic } from './types';

export function DiagnosticsBanner({ diagnostics }: { diagnostics: WorkboardDiagnostic[] }) {
  const { t } = useI18n();
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
        {t(diagnostics.length === 1 ? 'agents.workboard.diagnostics.warningOne' : 'agents.workboard.diagnostics.warningMany', { count: diagnostics.length })}:{' '}
        {diagnostics.slice(0, 3).map((d) => {
          const key = `agents.workboard.diagnostics.kind.${d.kind}`;
          return hasMessage(key) ? t(key) : d.kind;
        }).join(' · ')}
        {diagnostics.length > 3 ? ` · +${diagnostics.length - 3}` : ''}
      </span>
    </div>
  );
}
