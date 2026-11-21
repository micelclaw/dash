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

import { Calculator, ArrowLeftRight, Timer, Mic } from 'lucide-react';
import { useFloatingPanelsStore, type PanelId } from '@/stores/floating-panels.store';
import { useI18n } from '@/i18n';

const PANEL_ICONS: Record<PanelId, { icon: React.ReactNode }> = {
  calculator:       { icon: <Calculator size={16} /> },
  converter:        { icon: <ArrowLeftRight size={16} /> },
  pomodoro:         { icon: <Timer size={16} /> },
  'voice-recorder': { icon: <Mic size={16} /> },
};

export function MinimizedPanelsTray() {
  const { t } = useI18n();
  const panels = useFloatingPanelsStore((s) => s.panels);
  const restorePanel = useFloatingPanelsStore((s) => s.restorePanel);

  const minimized = Array.from(panels.entries()).filter(([, p]) => p.minimized);
  if (minimized.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={t('floating.tray')}
      style={{
        position: 'fixed',
        bottom: 52,
        right: 12,
        zIndex: 251,
        display: 'flex',
        gap: 4,
      }}
    >
      {minimized.map(([id]) => {
        const meta = PANEL_ICONS[id];
        const panelLabel = t(`floating.restore.${id === 'voice-recorder' ? 'voiceRecorder' : id}`);
        return (
          <button
            key={id}
            onClick={() => restorePanel(id)}
            title={panelLabel}
            aria-label={t('floating.restorePanel', { panel: panelLabel })}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              color: 'var(--mod-tools)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--card)'; }}
          >
            {meta.icon}
          </button>
        );
      })}
    </div>
  );
}
