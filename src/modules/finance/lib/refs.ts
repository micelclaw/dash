/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Primitivas COMPARTIDAS de los paneles de relaciones (DocumentRelatedPanel de
// Facturación y MovimientoRelatedPanel de Personal). Antes cada panel definía sus
// propios estilos de sección/fila/chip y su propio patrón de accesibilidad
// (role/tabIndex/onKeyDown) de forma divergente. SSOT aquí: mismo look y mismo
// comportamiento de teclado en las tres lentes.

import type React from 'react';

export const refSectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
};

export const refRowBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
  borderRadius: 'var(--radius-sm, 4px)', cursor: 'pointer', fontSize: 13,
};

export const refChipBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px',
  borderRadius: 999, border: '1px solid var(--border)', fontSize: 12,
};

/** Props de un elemento pulsable ACCESIBLE (role=button + teclado Enter/Espacio). */
export function clickable(onActivate: () => void): React.HTMLAttributes<HTMLDivElement> {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } },
  };
}

/** Handlers de hover para filas (fondo suave al pasar el ratón). */
export const hoverBg: React.HTMLAttributes<HTMLDivElement> = {
  onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; },
  onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
};
