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

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS: { title: string; items: { keys: string; desc: string }[] }[] = [
  {
    title: 'General',
    items: [
      { keys: 'Ctrl+S', desc: 'Save diagram' },
      { keys: 'Ctrl+Z', desc: 'Undo' },
      { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
      { keys: 'Ctrl+K', desc: 'Command Palette' },
      { keys: '?', desc: 'Show shortcuts' },
      { keys: 'Escape', desc: 'Clear selection / Exit mode' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: 'Ctrl+A', desc: 'Select all nodes' },
      { keys: 'Tab', desc: 'Select next node' },
      { keys: 'Shift+Tab', desc: 'Select previous node' },
      { keys: 'Delete / Backspace', desc: 'Delete selected' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { keys: 'Enter', desc: 'Edit selected node label' },
      { keys: 'Ctrl+D', desc: 'Duplicate selected' },
      { keys: 'Ctrl+C', desc: 'Copy' },
      { keys: 'Ctrl+V', desc: 'Paste' },
      { keys: 'Ctrl+G', desc: 'Group selected nodes' },
      { keys: 'Ctrl+Shift+G', desc: 'Ungroup' },
      { keys: 'Ctrl+]', desc: 'Bring to front' },
      { keys: 'Ctrl+[', desc: 'Send to back' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: 'Ctrl+0', desc: 'Fit view' },
      { keys: 'Ctrl+1', desc: 'Zoom to 100%' },
      { keys: 'Ctrl+2-9', desc: 'Save viewport bookmark' },
      { keys: '2-9', desc: 'Navigate to bookmark' },
      { keys: 'F11', desc: 'Toggle presentation mode' },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
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
      aria-label="Keyboard shortcuts"
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
            Keyboard Shortcuts
          </span>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
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
                {group.title}
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
                    {item.desc}
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
