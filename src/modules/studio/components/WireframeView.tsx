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

// ─── Studio A3 — wireframe cards ("Boceto rápido") ──────────────────
//
// Renders the ASCII wireframes the Frontend doc-phase emitted (parsed by
// lib/mockups.ts) as styled cards: one card per screen, a header chip with
// the screen name + a monospace <pre> of the half-open box. The <pre> reuses
// the EXACT PRE_STYLE from StreamingMarkdown so ASCII boxes (┌─┐│├┤└┘) render
// as a continuous grid (tight line-height, no ligatures, whiteSpace pre).
// Tokens-only styling — no hardcoded palette.

import { PencilRuler } from 'lucide-react';
import type { WireframeScreen } from '../lib/mockups';

interface WireframeViewProps {
  screens: WireframeScreen[];
}

// EXACT copy of StreamingMarkdown's PRE_STYLE (monospace, lineHeight 1.2,
// whiteSpace pre, fontVariantLigatures none, overflowX auto) — kept verbatim
// so wireframes here render identically to those inside the markdown body.
const PRE_STYLE: React.CSSProperties = {
  margin: 0,
  padding: '12px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  overflowX: 'auto',
  fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  color: 'var(--text)',
  whiteSpace: 'pre',
  fontVariantLigatures: 'none',
  fontFeatureSettings: 'normal',
  tabSize: 2,
  textAlign: 'left',
};

export function WireframeView({ screens }: WireframeViewProps) {
  if (screens.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <PencilRuler size={16} style={{ color: 'var(--amber)' }} />
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>Boceto rápido</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {screens.map((s, i) => (
          <div
            key={`${s.name}-${i}`}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--card)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                color: 'var(--text)',
                background: 'color-mix(in srgb, var(--amber) 16%, var(--card))',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                padding: '2px 10px',
              }}>
                {s.name}
              </span>
            </div>
            <div style={{ padding: 12 }}>
              <pre style={PRE_STYLE}>{s.ascii}</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
