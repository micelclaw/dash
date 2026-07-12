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

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CollapsibleSectionProps {
  icon: LucideIcon;
  title: string;
  /** Nº para el badge (p.ej. enlaces activos / personas). 0/undefined = sin badge. */
  badge?: number;
  defaultOpen?: boolean;
  /** Fuerza apertura desde fuera (p.ej. initialSection del modal). */
  forceOpen?: boolean;
  children: ReactNode;
}

/** Sección colapsable del modal de compartir (header + chevron + badge). */
export function CollapsibleSection({ icon: Icon, title, badge, defaultOpen = false, forceOpen, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen || !!forceOpen);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 12px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font-sans)',
          fontSize: '0.8125rem', textAlign: 'left',
        }}
      >
        <Icon size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, flex: 1 }}>{title}</span>
        {typeof badge === 'number' && badge > 0 && (
          <span style={{
            fontSize: '0.6875rem', fontWeight: 600, padding: '1px 7px',
            borderRadius: 'var(--radius-full)', background: 'var(--amber)', color: '#000',
          }}>
            {badge}
          </span>
        )}
        {open ? <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />}
      </button>
      {open && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
