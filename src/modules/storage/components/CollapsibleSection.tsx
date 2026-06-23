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

// ─── CollapsibleSection ────────────────────────────────────────────
// Cabecera clicable (chevron + icono opcional + título + contador
// opcional) que expande/colapsa su contenido. Inline-styles con
// var(--*) para combinar con el resto del módulo de Storage.

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  icon,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '12px 14px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{ display: 'inline-flex', color: 'var(--text-dim)', flexShrink: 0 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        {icon && (
          <span style={{ display: 'inline-flex', color: 'var(--mod-storage)', flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <span style={{ fontSize: '0.875rem', fontWeight: 600, flex: 1 }}>{title}</span>
        {count != null && (
          <span
            style={{
              flexShrink: 0, minWidth: 20, padding: '1px 7px', textAlign: 'center',
              fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)',
              background: 'var(--bg, var(--surface))', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill, 999px)',
            }}
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: 14 }}>{children}</div>
        </div>
      )}
    </div>
  );
}
