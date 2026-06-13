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

import { X, History } from 'lucide-react';
import { SnapshotSettingsForm } from '../../settings/SnapshotSettingsForm';

interface DriveSettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save. */
  onSaved?: () => void;
}

/**
 * Drive snapshot settings, modal form (D5). Opened from the inspector
 * → Versions gear. The form body lives in the shared `SnapshotSettingsForm`
 * (also rendered inline by Drive Settings → Versioning); this component is
 * just the modal chrome around it.
 */
export function DriveSettingsModal({ open, onClose, onSaved }: DriveSettingsModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: 460, maxWidth: '92vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <History size={15} style={{ color: 'var(--mod-drive)' }} />
            Drive snapshot settings
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 2, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body — shared form */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 20px' }}>
          <SnapshotSettingsForm
            onSaved={() => { onSaved?.(); onClose(); }}
            footerExtra={(
              <button
                onClick={onClose}
                style={{
                  padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                  fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
}
