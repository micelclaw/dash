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
import { FlaskConical } from 'lucide-react';

// Banner shown while the storage module runs the simulated "NAS preview"
// (demo provider). Makes it unmistakable the disks/RAID/volumes/shares are fake.
export function DemoModeBanner({ onExit }: { onExit: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);

  const handleExit = async () => {
    setBusy(true);
    try {
      await onExit();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 16px', alignItems: 'flex-start',
      background: 'color-mix(in srgb, var(--mod-storage) 12%, var(--surface))',
      border: '1px solid color-mix(in srgb, var(--mod-storage) 45%, var(--border))',
      borderRadius: 'var(--radius-md)',
    }}>
      <FlaskConical size={18} style={{ color: 'var(--mod-storage)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        <strong style={{ color: 'var(--text)' }}>Modo vista previa (demo)</strong> — los discos, el NAS ZFS, los
        pools RAID, los volúmenes y las carpetas compartidas de abajo están{' '}
        <strong style={{ color: 'var(--text)' }}>simulados</strong>, no es hardware real.
        Así se ve el módulo de Almacenamiento con la capa NAS ZFS sobre bare-metal.
      </div>
      <button
        onClick={handleExit}
        disabled={busy}
        style={{
          flexShrink: 0, padding: '6px 12px', background: 'transparent',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600,
          fontFamily: 'var(--font-sans)', cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
        }}
      >
        {busy ? 'Saliendo…' : 'Salir de la vista previa'}
      </button>
    </div>
  );
}
