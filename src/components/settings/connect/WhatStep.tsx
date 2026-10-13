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

// ─── Ventana 1 · QUÉ tipo de datos ──────────────────────────────────────────
//
// El cambio de modelo mental que pidió el usuario, y el motivo por el que esta
// ventana va PRIMERA y no segunda:
//
// La pantalla vieja preguntaba por una dirección de correo antes de saber qué
// querías traer. Su crítica fue exacta: *"quizás lo que yo quisiera sincronizar
// eran unas notas o un calendario, no sé por qué me pides una cuenta de correo"*.
//
// Y hay una razón TÉCNICA además de la de sentido común, que también salió de él:
// una autorización OAuth se pide **con los permisos por delante**. Si primero se
// eligiera el proveedor y luego se mirara "qué hay dentro", habría que pedirle a
// Google correo + calendario + contactos de golpe para luego preguntar qué
// querías. Elegir el tipo de dato PRIMERO es lo que permite pedir un solo
// permiso.
//
// Los nueve botones tienen el MISMO peso visual a propósito (decisión del
// usuario: "no quiero que los diferencies en mi día a día y tus bibliotecas, no,
// todos tienen la misma importancia").

import { DATA_TYPES, type DataTypeMeta } from '@/config/data-types';

interface WhatStepProps {
  /** Cuántas integraciones hay ya de cada tipo, para el contador de la baldosa. */
  counts: Record<string, number>;
  onPick: (t: DataTypeMeta) => void;
}

export function WhatStep({ counts, onPick }: WhatStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.9375rem',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        ¿Qué tipo de datos quieres conectar?
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {DATA_TYPES.map((t) => {
          const Icon = t.icon;
          const n = counts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              aria-label={t.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '18px 8px 14px',
                minHeight: 104,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.borderColor = 'var(--amber)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <Icon size={24} style={{ color: 'var(--amber)' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{t.label}</span>
              {/*
                El contador sale del ESTADO REAL (las integraciones que hay), no
                de una lista fija. Si no hay ninguna no se escribe "0": se deja
                el hueco, porque un cero es ruido.
              */}
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  minHeight: 14,
                }}
              >
                {n > 0 ? `${n} conectad${n === 1 ? 'a' : 'as'}` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
