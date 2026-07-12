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

// ─── Studio — Shared skippable tour strip ───────────────────────────
//
// The one-line onboarding tour used across Studio screens: a compact
// amber strip that walks through `steps` one at a time and remembers
// dismissal in localStorage under `storageKey`. Renders nothing once
// seen (or when localStorage is unreachable — private mode).

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

interface Props {
  /** localStorage key that marks the tour as seen ('1'). */
  storageKey: string;
  /** Ordered tour messages, shown one at a time. */
  steps: string[];
}

export function TourStrip({ storageKey, steps }: Props) {
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return true; }
  });
  const [step, setStep] = useState(0);

  function dismiss() {
    setSeen(true);
    try { localStorage.setItem(storageKey, '1'); } catch { /* private mode */ }
  }

  if (seen || steps.length === 0) return null;

  return (
    <div style={strip}>
      <Sparkles size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.4 }}>
        {steps[step]}
      </span>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{step + 1}/{steps.length}</span>
      {step < steps.length - 1 ? (
        <button onClick={() => setStep((s) => s + 1)} style={nextBtn}>Next</button>
      ) : (
        <button onClick={dismiss} style={nextBtn}>Got it!</button>
      )}
      <button onClick={dismiss} style={skipBtn} aria-label="Skip">
        <X size={13} />
      </button>
    </div>
  );
}

const strip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 18,
  background: 'color-mix(in srgb, var(--amber) 8%, var(--card))',
  border: '1px solid color-mix(in srgb, var(--amber) 30%, var(--border))',
  borderRadius: 'var(--radius-md)',
};
const nextBtn: React.CSSProperties = {
  padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600,
  background: 'var(--amber)', color: '#000', border: 'none',
  borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0,
};
const skipBtn: React.CSSProperties = {
  display: 'flex', padding: 2, background: 'transparent', border: 'none',
  color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
};

export default TourStrip;
