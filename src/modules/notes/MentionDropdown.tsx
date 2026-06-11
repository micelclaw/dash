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

// Dropdown del sistema de menciones `@` del editor de notas: lista de
// resultados de GET /search (todos los dominios mencionables) agrupados
// visualmente por dominio con el icono/color de ENTITY_REF_MAP. Navegación
// con ↑↓/Enter (el suggestion plugin de TipTap reenvía el teclado vía
// useImperativeHandle, patrón estándar de @tiptap/extension-mention).

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ENTITY_REF_MAP } from '@/config/entity-refs';

export interface MentionItem {
  domain: string;
  id: string;
  label: string;
  snippet?: string;
}

interface MentionDropdownProps {
  items: MentionItem[];
  command: (attrs: { id: string; label: string; domain: string }) => void;
}

export interface MentionDropdownHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionDropdown = forwardRef<MentionDropdownHandle, MentionDropdownProps>(
  function MentionDropdown({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const select = (index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.label, domain: item.domain });
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          select(selectedIndex);
          return true;
        }
        return false;
      },
    }), [items, selectedIndex]);

    if (items.length === 0) {
      return (
        <div style={panelStyle}>
          <div style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Sin resultados…
          </div>
        </div>
      );
    }

    return (
      <div style={panelStyle}>
        {items.map((item, i) => {
          const def = ENTITY_REF_MAP[item.domain];
          const Icon = def?.Icon;
          const color = def?.color ?? 'var(--text-dim)';
          return (
            <button
              key={`${item.domain}:${item.id}`}
              onClick={() => select(i)}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '5px 10px', background: i === selectedIndex ? 'var(--surface-hover)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {Icon && <Icon size={13} style={{ color, flexShrink: 0 }} />}
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                {item.label}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {def?.label ?? item.domain}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

const panelStyle: React.CSSProperties = {
  minWidth: 280,
  maxWidth: 360,
  maxHeight: 280,
  overflowY: 'auto',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  boxShadow: 'var(--shadow-lg)',
  padding: '4px 0',
};
