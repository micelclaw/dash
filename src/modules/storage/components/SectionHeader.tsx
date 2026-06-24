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

// ─── SectionHeader ─────────────────────────────────────────────────
// Cabecera grande que delimita cada zona del módulo Storage: chip de
// icono tintado + título (más grande si `emphasis`) + una frase de
// descripción en lenguaje llano + un slot opcional a la derecha
// (píldoras de estado, contadores, toggles). El wrapper lleva `id` +
// scrollMarginTop para que la navegación por anclas aterrice limpia
// justo debajo de la cabecera de la página. Inline-styles con var(--*)
// para combinar con el resto del módulo (que no usa Tailwind).

import type { ReactNode } from 'react';

export function SectionHeader({
  id,
  icon,
  title,
  subtitle,
  right,
  emphasis = false,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  emphasis?: boolean;
}) {
  const chipSize = emphasis ? 40 : 34;

  return (
    <div
      id={id}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        // Deja aire bajo el título y una fina línea que separa la cabecera
        // de su contenido sin competir con los bordes de las tarjetas.
        paddingBottom: 10,
        borderBottom: `1px solid ${emphasis
          ? 'color-mix(in srgb, var(--mod-storage) 30%, var(--border))'
          : 'var(--border)'}`,
        // El ancla aterriza con un pequeño margen superior.
        scrollMarginTop: 16,
      }}
    >
      {/* Chip de icono tintado con el color del módulo */}
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: chipSize, height: chipSize, flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, var(--mod-storage) 14%, transparent)',
          color: 'var(--mod-storage)',
        }}
      >
        {icon}
      </span>

      {/* Título + descripción */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            margin: 0,
            fontSize: emphasis ? '1.1875rem' : '1.0625rem',
            fontWeight: emphasis ? 700 : 600,
            color: 'var(--text)', fontFamily: 'var(--font-sans)', lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              margin: '3px 0 0',
              fontSize: '0.75rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Slot derecho (píldoras, contadores, toggles) */}
      {right && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {right}
        </div>
      )}
    </div>
  );
}
