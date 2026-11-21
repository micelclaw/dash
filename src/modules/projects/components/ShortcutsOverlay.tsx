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

import { X } from 'lucide-react';
import { useI18n } from '@/i18n';

const SHORTCUTS = [
  {
    id: 'navigation',
    categoryKey: 'projects.shortcutsOverlay.category.navigation',
    items: [
      { keys: 'Escape', actionKey: 'projects.shortcutsOverlay.action.closeCard' },
      { keys: '/', actionKey: 'projects.shortcutsOverlay.action.focusSearch' },
      { keys: '?', actionKey: 'projects.shortcutsOverlay.action.toggleHelp' },
    ],
  },
  {
    id: 'views',
    categoryKey: 'projects.shortcutsOverlay.category.views',
    items: [
      { keys: 'Alt+1', actionKey: 'projects.shortcutsOverlay.action.boardView' },
      { keys: 'Alt+2', actionKey: 'projects.shortcutsOverlay.action.tableView' },
      { keys: 'Alt+3', actionKey: 'projects.shortcutsOverlay.action.ganttView' },
      { keys: 'Alt+4', actionKey: 'projects.shortcutsOverlay.action.calendarView' },
      { keys: 'Alt+5', actionKey: 'projects.shortcutsOverlay.action.dashboardView' },
    ],
  },
  {
    id: 'card-operations',
    categoryKey: 'projects.shortcutsOverlay.category.cardOperations',
    items: [
      { keys: '1-4', actionKey: 'projects.shortcutsOverlay.action.priority' },
      { keys: 'x', actionKey: 'projects.shortcutsOverlay.action.multiSelect' },
      { keys: 'Delete', actionKey: 'projects.shortcutsOverlay.action.deleteCard' },
    ],
  },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(25px)' }} onClick={onClose} />
      <div style={{
        position: 'relative',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 480,
        maxHeight: '70vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{t('projects.shortcutsOverlay.title')}</span>
          <button
            onClick={onClose}
            aria-label={t('projects.shortcutsOverlay.close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {SHORTCUTS.map((group) => (
            <div key={group.id} style={{ marginBottom: 16 }}>
              <div style={{
                color: 'var(--text-dim)',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}>
                {t(group.categoryKey)}
              </div>
              {group.items.map((item) => (
                <div
                  key={item.keys}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                  }}
                >
                  <span style={{ color: 'var(--text)', fontSize: 12 }}>{t(item.actionKey)}</span>
                  <kbd style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono, monospace)',
                    minWidth: 28,
                    textAlign: 'center',
                  }}>
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
