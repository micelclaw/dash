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

// ─── ⋮ — apertura táctil del menú contextual ────────────────────────────────
// En móvil el long-press está reservado para la selección múltiple, así que el
// menú contextual se abre con este botoncito de tres puntos. No conoce el menú:
// despacha un `contextmenu` SINTÉTICO (isTrusted=false) que burbujea hasta el
// trigger del ContextMenu envolvente — que solo bloquea los táctiles REALES.
// Colócalo dentro de un contenedor position:relative (tile, fila, tarjeta).

import { useRef } from 'react';
import { MoreVertical } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

interface TileMoreButtonProps {
  /** Posición absoluta dentro del tile (default: esquina superior derecha). */
  style?: React.CSSProperties;
  size?: number;
}

export function TileMoreButton({ style, size = 15 }: TileMoreButtonProps) {
  const touchTsRef = useRef(0);
  return (
    <button
      aria-label="More actions"
      title="More actions"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        // El click sintetizado tras un LONG-press táctil no debe abrir el menú
        // (el gesto largo es de selección). ContextMenu ya lo traga a nivel
        // documento; esto es el cinturón por si llega por otra vía.
        if (e.nativeEvent.isTrusted && touchTsRef.current && Date.now() - touchTsRef.current >= 450) {
          touchTsRef.current = 0;
          return;
        }
        touchTsRef.current = 0;
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: r.left,
          clientY: r.bottom + 4,
        }));
      }}
      // Que el long-press/barrido no arranque desde el propio botón.
      onTouchStart={(e) => { e.stopPropagation(); touchTsRef.current = Date.now(); }}
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 3,
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        cursor: 'pointer',
        padding: 0,
        ...style,
      }}
    >
      <MoreVertical size={size} />
    </button>
  );
}

// ─── ⋮ de HEADER — menú sobre la SELECCIÓN completa ─────────────────────────
// Decisión 2026-07-11: NO hay ⋮ por tile/fila. Cuando hay items seleccionados,
// un ÚNICO ⋮ en la batch bar abre el menú contextual aplicado a TODA la
// selección (añadir varias a un álbum, descargar N, borrar N…). Compone el
// ContextMenu envolvente + el TileMoreButton con estilo de toolbar.
export function SelectionMenuButton({ items, style }: {
  items: ContextMenuItem[];
  style?: React.CSSProperties;
}) {
  return (
    <ContextMenu
      trigger={
        <TileMoreButton
          style={{
            position: 'static',
            width: 28,
            height: 28,
            flex: '0 0 auto',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            ...style,
          }}
        />
      }
      items={items}
    />
  );
}
