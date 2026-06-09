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

// Chips de entidad bajo un bloque de tool del chat. El backend marca el
// tool_call con `entity_refs: [{ type, id, title }]` (piloto: notas) y aquí
// renderizamos una pill cliqueable por ref que navega al registro. Aditivo: se
// muestra DEBAJO del bloque de tool, sin reemplazarlo. Sin flecha — toda la
// pill es cliqueable y el hover (fondo más claro) lo indica.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ENTITY_REF_MAP } from '@/config/entity-refs';

type EntityRef = { type: string; id: string; title: string | null };

const MAX_VISIBLE = 8;

function EntityChip({ refItem }: { refItem: EntityRef }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const def = ENTITY_REF_MAP[refItem.type];
  const title = refItem.title?.trim() || '(sin título)';

  // Tipo no mapeado → texto plano sin navegación (no romper).
  if (!def) {
    return (
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '2px 4px' }}>
        {title}
      </span>
    );
  }

  const Icon = def.Icon;
  return (
    <button
      type="button"
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        navigate(def.route(refItem.id));
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: 260,
        padding: '2px 9px',
        background: hover
          ? `color-mix(in srgb, ${def.color} 28%, transparent)`
          : `color-mix(in srgb, ${def.color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${def.color} 35%, transparent)`,
        borderRadius: 'var(--radius-full)',
        fontSize: '0.75rem',
        lineHeight: 1.6,
        color: 'var(--text)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'background var(--transition-fast)',
      }}
    >
      <Icon size={12} style={{ color: def.color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
    </button>
  );
}

export function EntityRefChips({ refs }: { refs: EntityRef[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!Array.isArray(refs) || refs.length === 0) return null;

  const shown = expanded ? refs : refs.slice(0, MAX_VISIBLE);
  const hidden = refs.length - shown.length;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {shown.map((r, i) => (
        <EntityChip key={`${r.type}-${r.id}-${i}`} refItem={r} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 9px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          +{hidden} más
        </button>
      )}
    </div>
  );
}
