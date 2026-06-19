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

import { useState } from 'react';
import { Info, Eye } from 'lucide-react';

export function NasLayerBanner({ provider, onPreview }: { provider: string; onPreview?: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);

  const handlePreview = async () => {
    if (!onPreview) return;
    setBusy(true);
    try {
      await onPreview();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 16px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', alignItems: 'flex-start',
    }}>
      <Info size={18} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        Advanced storage features (RAID pools, volume management, shared folders) require the NAS layer
        (OpenMediaVault) on bare-metal Debian. Current provider: <strong style={{ color: 'var(--text)' }}>{provider}</strong> (read-only).
        {onPreview && (
          <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
            Want to see how it would look? Try the preview with simulated disks.
          </div>
        )}
      </div>
      {onPreview && (
        <button
          onClick={handlePreview}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '6px 12px', background: 'var(--mod-storage)', border: 'none',
            borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
            fontFamily: 'var(--font-sans)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          <Eye size={13} />
          {busy ? 'Loading…' : 'Preview (demo)'}
        </button>
      )}
    </div>
  );
}
