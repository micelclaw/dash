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

import { Info } from 'lucide-react';

export function NasLayerBanner({ provider }: { provider: string }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 16px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <Info size={18} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        Advanced storage features (RAID pools, volume management, shared folders) require the NAS layer
        (OpenMediaVault) on bare-metal Debian. Current provider: <strong style={{ color: 'var(--text)' }}>{provider}</strong> (read-only).
      </div>
    </div>
  );
}
