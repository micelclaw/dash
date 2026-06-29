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

// ─── Studio V3-4 — the Guided "ficha" card ──────────────────────────
//
// Renders the structured summary the doc-phase emitted (see lib/ficha.ts)
// as a friendly card instead of raw markdown:
//   - Concept → "ficha-acuerdo" (§3.3): qué hará / quién la usa /
//     lo que incluye ✓ / lo que NO incluye por ahora (anti-decepción).
//   - Foundation → "el plan de construcción" (§3.5): hitos de obra.
// The technical markdown lives behind a "Ver detalles" toggle in the
// parent (DocPhaseLayout). Pure presentation; tokens-only styling.

import { Check, X, Hammer } from 'lucide-react';
import type { Ficha } from '../lib/ficha';

interface FichaViewProps {
  phase: 'concept' | 'frontend' | 'foundation';
  ficha: Ficha;
}

const card: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--card)',
  padding: '14px 16px',
  marginBottom: 12,
};

const sectionLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  marginBottom: 4,
};

export function FichaView({ phase, ficha }: FichaViewProps) {
  if (phase === 'foundation') {
    const milestones = ficha.milestones ?? [];
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Hammer size={16} style={{ color: 'var(--amber)' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>El plan de construcción</span>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {milestones.map((m, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--amber) 18%, var(--card))',
                color: 'var(--text)', fontSize: '0.72rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{m.title}</div>
                {m.detail && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>{m.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // concept (the "agreement card")
  const includes = ficha.includes ?? [];
  const excludes = ficha.excludes ?? [];
  return (
    <div style={card}>
      {ficha.does && (
        <div style={{ marginBottom: 12 }}>
          <div style={sectionLabel}>¿Qué hará?</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.45 }}>{ficha.does}</div>
        </div>
      )}
      {ficha.audience && (
        <div style={{ marginBottom: 12 }}>
          <div style={sectionLabel}>¿Para quién?</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.45 }}>{ficha.audience}</div>
        </div>
      )}
      {(includes.length > 0 || excludes.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: excludes.length > 0 ? '1fr 1fr' : '1fr', gap: 14 }}>
          {includes.length > 0 && (
            <div>
              <div style={{ ...sectionLabel, color: 'var(--green, #16a34a)' }}>Lo que incluye</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {includes.map((it, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.8rem', color: 'var(--text)' }}>
                    <Check size={14} style={{ color: 'var(--green, #16a34a)', flexShrink: 0, marginTop: 2 }} />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {excludes.length > 0 && (
            <div>
              <div style={{ ...sectionLabel }}>Lo que NO incluye por ahora</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {excludes.map((it, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <X size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
