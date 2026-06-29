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

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface AgentSelectOption {
  value: string;
  label: string;
  desc?: string;
}

interface AgentSelectProps {
  value: string;
  options: AgentSelectOption[];
  onChange: (v: string) => void;
  minWidth?: number;
  disabled?: boolean;
}

/**
 * Select custom coherente con el sistema de diseño del módulo Agents
 * (estilos inline con CSS vars, sin <select> nativo). Muestra la descripción
 * de cada opción en el dropdown — algo que el <select> nativo no permite.
 * Cierre por click-fuera + Escape; opción activa resaltada en ámbar.
 */
export function AgentSelect({ value, options, onChange, minWidth = 180, disabled }: AgentSelectProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const current = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
          padding: '5px 9px', fontSize: '0.75rem',
          background: 'var(--surface)', border: `1px solid ${open ? 'var(--amber)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          fontFamily: 'var(--font-sans)', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1, transition: 'var(--transition-fast)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.label ?? value}
        </span>
        <ChevronDown size={13} style={{ opacity: 0.7, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 60,
          minWidth: '100%', maxWidth: 280, maxHeight: 300, overflowY: 'auto',
          background: 'rgba(24, 24, 27, 0.97)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)', padding: 4,
        }}>
          {options.map(o => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                onMouseEnter={() => setHovered(o.value)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: hovered === o.value ? 'var(--surface-hover)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                  transition: 'var(--transition-fast)',
                }}
              >
                <Check size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--amber)', opacity: selected ? 1 : 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: selected ? 600 : 500, color: selected ? 'var(--amber)' : 'var(--text)' }}>
                    {o.label}
                  </div>
                  {o.desc && (
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.3 }}>
                      {o.desc}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
