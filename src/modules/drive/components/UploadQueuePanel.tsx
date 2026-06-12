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

import { X, CheckCircle2, AlertCircle, Loader2, Upload } from 'lucide-react';
import { formatFileSize } from '@/lib/file-utils';
import type { UploadQueueItem } from '../hooks/use-upload-queue';

/**
 * Floating bottom-right upload queue (D6) — one row per file with a live
 * progress bar and status. Auto-dismisses via the hook once everything is
 * done; errors stay until the user closes the panel.
 */
export function UploadQueuePanel({ items, onClear }: {
  items: UploadQueueItem[];
  onClear: () => void;
}) {
  if (items.length === 0) return null;

  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const inFlight = items.some(i => i.status === 'uploading' || i.status === 'queued');

  const title = inFlight
    ? `Uploading ${Math.min(doneCount + 1, items.length)} of ${items.length}…`
    : errorCount > 0
      ? `Uploads finished — ${errorCount} failed`
      : 'Uploads complete';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 'var(--z-toast)' as unknown as number,
        width: 320,
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <Upload size={14} style={{ color: 'var(--mod-drive)', flexShrink: 0 }} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 600,
          color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        {!inFlight && (
          <button
            onClick={onClear}
            title="Close"
            aria-label="Close upload panel"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Rows */}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {items.map(item => (
          <UploadRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function UploadRow({ item }: { item: UploadQueueItem }) {
  const statusIcon = item.status === 'done'
    ? <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
    : item.status === 'error'
      ? <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
      : item.status === 'uploading'
        ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--mod-drive)', flexShrink: 0 }} />
        : <Loader2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {statusIcon}
        <span
          title={item.name}
          style={{
            flex: 1, minWidth: 0, fontSize: '0.75rem', color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {item.status === 'uploading'
            ? `${item.progress}%`
            : item.status === 'queued'
              ? 'Queued'
              : item.status === 'error'
                ? 'Failed'
                : formatFileSize(item.size)}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: 6, height: 3, borderRadius: 2,
        background: 'var(--surface)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${item.status === 'done' ? 100 : item.progress}%`,
          background: item.status === 'error' ? 'var(--error)' : 'var(--mod-drive)',
          borderRadius: 2,
          transition: 'width 0.15s ease-out',
        }} />
      </div>

      {item.status === 'error' && item.error && (
        <div style={{ marginTop: 4, fontSize: '0.6875rem', color: 'var(--error)' }}>
          {item.error}
        </div>
      )}
    </div>
  );
}
