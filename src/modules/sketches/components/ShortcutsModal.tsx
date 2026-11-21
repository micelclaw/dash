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

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS: { title: string; titleKey: string; items: { keys: string; descKey: string }[] }[] = [
  {
    title: 'General', titleKey: 'sketches.shortcuts.group.general',
    items: [
      { keys: 'Ctrl+S', descKey: 'sketches.shortcuts.general.saveDiagram' },
      { keys: 'Ctrl+Z', descKey: 'sketches.shortcuts.general.undo' },
      { keys: 'Ctrl+Shift+Z', descKey: 'sketches.shortcuts.general.redo' },
      { keys: 'Ctrl+K', descKey: 'sketches.shortcuts.general.commandPalette' },
      { keys: '?', descKey: 'sketches.shortcuts.general.showShortcuts' },
      { keys: 'Escape', descKey: 'sketches.shortcuts.general.clearSelection' },
    ],
  },
  {
    title: 'Selection', titleKey: 'sketches.shortcuts.group.selection',
    items: [
      { keys: 'Ctrl+A', descKey: 'sketches.shortcuts.selection.selectAll' },
      { keys: 'Tab', descKey: 'sketches.shortcuts.selection.next' },
      { keys: 'Shift+Tab', descKey: 'sketches.shortcuts.selection.previous' },
      { keys: 'Delete / Backspace', descKey: 'sketches.shortcuts.selection.delete' },
    ],
  },
  {
    title: 'Edit', titleKey: 'sketches.shortcuts.group.edit',
    items: [
      { keys: 'Enter', descKey: 'sketches.shortcuts.edit.editLabel' },
      { keys: 'Ctrl+D', descKey: 'sketches.shortcuts.edit.duplicate' },
      { keys: 'Ctrl+C', descKey: 'sketches.shortcuts.edit.copy' },
      { keys: 'Ctrl+V', descKey: 'sketches.shortcuts.edit.paste' },
      { keys: 'Ctrl+G', descKey: 'sketches.shortcuts.edit.group' },
      { keys: 'Ctrl+Shift+G', descKey: 'sketches.shortcuts.edit.ungroup' },
      { keys: 'Ctrl+]', descKey: 'sketches.shortcuts.edit.bringFront' },
      { keys: 'Ctrl+[', descKey: 'sketches.shortcuts.edit.sendBack' },
    ],
  },
  {
    title: 'Navigation', titleKey: 'sketches.shortcuts.group.navigation',
    items: [
      { keys: 'Ctrl+0', descKey: 'sketches.shortcuts.navigation.fit' },
      { keys: 'Ctrl+1', descKey: 'sketches.shortcuts.navigation.zoom100' },
      { keys: 'Ctrl+2-9', descKey: 'sketches.shortcuts.navigation.saveBookmark' },
      { keys: '2-9', descKey: 'sketches.shortcuts.navigation.openBookmark' },
      { keys: 'F11', descKey: 'sketches.shortcuts.navigation.presentation' },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('sketches.shortcuts.dialogTitle')}
    >
      <div
        style={{
          background: 'var(--surface, #1a1a1a)',
          border: '1px solid var(--border, #333)',
          borderRadius: 12,
          width: 520,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border, #333)',
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text, #e2e8f0)',
            fontFamily: 'var(--font-sans, system-ui)',
            flex: 1,
          }}>
            {t('sketches.shortcuts.title')}
          </span>
          <button
            onClick={onClose}
            aria-label={t('sketches.shortcuts.close')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-dim, #94a3b8)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcut groups in 2-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 0,
          padding: '8px 0',
        }}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} style={{ padding: '8px 16px' }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--amber, #d4a017)',
                fontFamily: 'var(--font-sans, system-ui)',
                marginBottom: 8,
              }}>
                {t(group.titleKey)}
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
                  <span style={{
                    fontSize: 12,
                    color: 'var(--text, #e2e8f0)',
                    fontFamily: 'var(--font-sans, system-ui)',
                  }}>
                    {t(item.descKey)}
                  </span>
                  <kbd style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-dim, #94a3b8)',
                    background: 'var(--background, #111)',
                    border: '1px solid var(--border, #333)',
                    borderRadius: 3,
                    padding: '1px 5px',
                    whiteSpace: 'nowrap',
                    marginLeft: 8,
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
