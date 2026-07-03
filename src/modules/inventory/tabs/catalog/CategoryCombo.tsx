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

import { useMemo, useState } from 'react';
import { inputStyle } from '@/modules/inventory/ui';

/** Categorías sugeridas (se mergean con las ya usadas en el inventario). */
const SUGGESTED_CATEGORIES = [
  'electronics', 'appliance', 'tool', 'vehicle', 'consumable',
  'furniture', 'sport', 'clothing', 'seguro',
];

/**
 * Combo de categoría con dropdown propio. Sustituye al <datalist> nativo,
 * que filtra las opciones por el valor actual del input — al reabrirlo con
 * una categoría ya seleccionada solo mostraba esa (bug reportado).
 * Regla: si el texto actual ES una opción exacta (o está vacío), se muestra
 * la lista completa; solo se filtra mientras se escribe algo nuevo.
 */
export function CategoryCombo({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const all = useMemo(
    () => [...new Set([...options, ...SUGGESTED_CATEGORIES])].sort(),
    [options],
  );
  const query = value.trim().toLowerCase();
  const visible = query && !all.includes(query)
    ? all.filter(c => c.toLowerCase().includes(query))
    : all;

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={value}
        placeholder="e.g. electronics"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      />
      {open && visible.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 2,
          maxHeight: 180,
          overflowY: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          zIndex: 120,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {visible.map(c => (
            <div
              key={c}
              onMouseDown={e => { e.preventDefault(); onChange(c); setOpen(false); }}
              style={{
                padding: '6px 10px',
                fontSize: '0.8125rem',
                color: c === query ? 'var(--amber)' : 'var(--text)',
                cursor: 'pointer',
                background: 'transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
