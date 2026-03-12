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

import { Music } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';

export function TrackInfo() {
  const currentItem = usePlayerStore((s) => s.currentItem);
  if (!currentItem) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: 200 }}>
      {/* Cover art or fallback icon */}
      {currentItem.coverBase64 ? (
        <img
          src={currentItem.coverBase64}
          alt=""
          style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            background: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Music size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--text)',
          }}
        >
          {currentItem.title}
        </div>
        {currentItem.artist && (
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentItem.artist}
          </div>
        )}
      </div>
    </div>
  );
}
