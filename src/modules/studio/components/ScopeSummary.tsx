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

// ─── Studio scoping wizard — Battery 4 confirmation card ────────────
// Shows the classification result (level, components, credits) and
// gives the user "back" + "start exploration" CTAs.

import { ChevronLeft, Sparkles } from 'lucide-react';
import type { ScopingClassification } from '@/stores/studio.store';

interface Props {
  classification: ScopingClassification;
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
}

const LEVEL_COPY: Record<string, { label: string; description: string; color: string }> = {
  L1: {
    label: 'L1 — Skill del asistente',
    description: 'Una habilidad pura para el agente IA. Sin UI ni base de datos propia.',
    color: '#22c55e',
  },
  L2: {
    label: 'L2 — App con backend',
    description: 'Una app completa con su propia API, base de datos y pantalla.',
    color: '#3b82f6',
  },
  L3: {
    label: 'L3 — Integración con servicio',
    description: 'Conecta con un container Docker o un servicio externo gestionado.',
    color: '#a855f7',
  },
};

export function ScopeSummary({ classification, onBack, onConfirm, submitting }: Props) {
  const { app_level, detected_components, credits_estimate } = classification;
  const lvl = LEVEL_COPY[app_level];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{
          fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--text)',
        }}>
          Resumen de tu proyecto
        </h2>
        <p style={{
          margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)',
        }}>
          He clasificado tu idea con la información que me has dado. Si todo
          encaja, podemos pasar a la fase de exploración.
        </p>
      </div>

      {/* Level badge */}
      <div style={{
        padding: 16,
        background: 'var(--card)',
        border: `1px solid ${lvl.color}33`,
        borderLeft: `3px solid ${lvl.color}`,
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{
          fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--text-muted)', marginBottom: 4,
        }}>
          Nivel
        </div>
        <div style={{
          fontSize: '0.9375rem', fontWeight: 600, color: lvl.color,
        }}>
          {lvl.label}
        </div>
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5,
        }}>
          {lvl.description}
        </div>
      </div>

      {/* Components */}
      <div style={{
        padding: 16,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{
          fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--text-muted)', marginBottom: 8,
        }}>
          Componentes detectados
        </div>
        {detected_components.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Sin componentes adicionales — sólo el skill base.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {detected_components.map((c) => (
              <span
                key={c}
                style={{
                  padding: '4px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  color: 'var(--text)',
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Credits */}
      <div style={{
        padding: 16,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Sparkles size={20} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <div>
          <div style={{
            fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em',
            color: 'var(--text-muted)',
          }}>
            Créditos estimados
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            ~{credits_estimate} créditos
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '10px 16px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)', fontSize: '0.8125rem', cursor: submitting ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronLeft size={14} /> Cambiar respuestas
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: submitting ? 'var(--surface)' : 'var(--amber)',
            color: submitting ? 'var(--text-dim)' : '#000',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontWeight: 600,
            cursor: submitting ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {submitting ? 'Guardando…' : 'Empezar exploración →'}
        </button>
      </div>
    </div>
  );
}
