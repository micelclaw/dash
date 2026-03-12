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

import { X, Trash2 } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';

export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const toggleQueuePanel = usePlayerStore((s) => s.toggleQueuePanel);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        width: 280,
        maxHeight: 320,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        zIndex: 20,
        marginBottom: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Queue ({queue.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={clearQueue}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)' }}
            title="Clear queue"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={toggleQueuePanel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', maxHeight: 260 }}>
        {queue.map((item, i) => (
          <div
            key={`${item.fileId}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              fontSize: '0.78rem',
              background: i === queueIndex ? 'var(--accent-bg)' : 'transparent',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i === queueIndex && <span style={{ color: 'var(--accent)' }}>&#9654; </span>}
              {item.title}
              {item.artist && <span style={{ color: 'var(--text-muted)' }}> — {item.artist}</span>}
            </span>
            <button
              onClick={() => removeFromQueue(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)', flexShrink: 0 }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
