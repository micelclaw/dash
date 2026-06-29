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

// ─── Studio v3 — empathetic error template (§8, transversal) ────────
//
// The universal "something went wrong" surface for Guided mode. NEVER a
// stack trace in the user's face. Three parts, always:
//   (a) what happened, in plain words (no jargon)
//   (b) reassurance — nothing broke, your data is safe
//   (c) 2-3 ways out, one of which is ALWAYS a "go back" (no dead ends)
// The raw technical detail lives behind a collapsible "ver detalle" for
// the curious / for Pro, never up front.

import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

export interface FriendlyAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface Props {
  /** Plain-language headline. Default: a generic empathetic line. */
  title?: string;
  /** One human sentence on what happened (optional, no jargon). */
  message?: string;
  /** Raw technical detail — hidden behind "ver detalle técnico". */
  detail?: string;
  /** Ways out. At least one should be a "go back". Rendered left→right. */
  actions: FriendlyAction[];
  /** Override the reassurance line if a surface needs a tailored one. */
  reassurance?: string;
}

export function FriendlyError({ title, message, detail, actions, reassurance }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div style={wrap} role="alert">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertCircle size={18} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
            {title ?? 'Algo no salió como esperaba'}
          </div>
          {message && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.45 }}>
              {message}
            </div>
          )}
          <div style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden>🔒</span>
            {reassurance ?? 'No se ha roto nada — tu idea y tus datos están a salvo.'}
          </div>
        </div>
      </div>

      {/* Ways out — never a dead end */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} style={a.primary ? btnPrimary : btnGhost}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Technical detail — opt-in, never in the user's face */}
      {detail && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowDetail((v) => !v)} style={detailToggle}>
            {showDetail ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Ver detalle técnico
          </button>
          {showDetail && (
            <pre style={detailBox}>{detail}</pre>
          )}
        </div>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: 16, margin: 12,
  background: 'color-mix(in srgb, var(--amber) 7%, var(--card))',
  border: '1px solid color-mix(in srgb, var(--amber) 35%, var(--border))',
  borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', flexShrink: 0,
};
const btnPrimary: React.CSSProperties = {
  padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600,
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const btnGhost: React.CSSProperties = {
  padding: '7px 14px', fontSize: '0.78rem', fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const detailToggle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: 0, background: 'transparent', border: 'none',
  color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const detailBox: React.CSSProperties = {
  marginTop: 6, padding: 10, maxHeight: 160, overflow: 'auto',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: '0.68rem',
  color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap',
};

export default FriendlyError;
