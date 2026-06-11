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
import { FileVersionHistory } from '@/components/shared/FileVersionHistory';
import type { FileRecord } from '@/types/files';

interface VersionHistoryDialogProps {
  open: boolean;
  file: FileRecord;
  onClose: () => void;
}

/**
 * Thin dialog wrapper (D4) hosting the shared FileVersionHistory panel —
 * lets the Drive context menu open version history without a preview panel.
 */
export function VersionHistoryDialog({ open, file, onClose }: VersionHistoryDialogProps) {
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
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 460, maxWidth: '90vw', maxHeight: '80vh',
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
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <History size={15} style={{ flexShrink: 0, color: 'var(--mod-drive)' }} />
            Version history: {file.filename}
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 2, flexShrink: 0, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <FileVersionHistory fileId={file.id} filename={file.filename} defaultExpanded />
        </div>
      </div>
    </div>
  );
}
