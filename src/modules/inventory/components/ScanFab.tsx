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

import { useState, type CSSProperties } from 'react';
import { ScanLine, X } from 'lucide-react';
import { ScannerModal, SCAN_INTENTS, type ScanIntent } from '@/modules/inventory/components/ScannerModal';

const fab: CSSProperties = {
  position: 'absolute', right: 20, bottom: 20, zIndex: 40,
  width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'var(--mod-inventory, var(--amber))', color: '#06060a',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: 'var(--shadow-lg)',
};
const menu: CSSProperties = {
  position: 'absolute', right: 20, bottom: 84, zIndex: 40,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
  width: 240,
};
const itemRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
  background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  color: 'var(--text)', textAlign: 'left', width: '100%',
};

/** FAB global de escaneo con menú de INTENCIÓN (nunca escaneo a ciegas). */
export function ScanFab() {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<ScanIntent | null>(null);

  return (
    <>
      {open && (
        <div style={menu} role="menu" aria-label="Scan actions">
          {SCAN_INTENTS.map(({ id, label, hint, Icon }) => (
            <button
              key={id}
              role="menuitem"
              style={itemRow}
              onClick={() => { setIntent(id); setOpen(false); }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = 'var(--card)'); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); }}
            >
              <Icon size={16} style={{ color: 'var(--mod-inventory, var(--amber))', flexShrink: 0 }} />
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        style={fab}
        onClick={() => setOpen(o => !o)}
        title="Scan a QR code"
        aria-label="Scan"
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <ScanLine size={22} />}
      </button>

      {intent && <ScannerModal intent={intent} onClose={() => setIntent(null)} />}
    </>
  );
}
