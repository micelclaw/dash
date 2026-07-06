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

// ─── Studio A3 — real HTML mockups ("this is how it'll look") ────────
//
// Renders the self-contained HTML fragments the Frontend doc-phase emitted
// (parsed + sanitized by lib/mockups.ts) inside SANDBOXED iframes, each
// styled with the project's design tokens so the user SEES their app before
// it's built. Full-bleed: the previews take the whole available width (the
// old 480×360 fixed window read as a thumbnail); a desktop/mobile toggle
// mirrors the design canvas. `sandbox=""` (no scripts, no same-origin) —
// zero script/network surface even though the fragment came from the model.

import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import type { MockupScreen } from '../lib/mockups';

interface MockupPreviewProps {
  screens: MockupScreen[];
  /** A `:root { … }` tokens CSS string (catalog system or feel-derived). */
  tokensCss: string;
}

/** Build the sandboxed document for one mockup screen. Tokens FIRST, then
 *  resets + var() fallbacks, then the sanitized fragment. */
function buildSrcDoc(tokensCss: string, html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
${tokensCss}
html,body{margin:0;padding:0}
*{box-sizing:border-box}
body{
  font-family: var(--font-body, system-ui, -apple-system, sans-serif);
  background: var(--color-bg, #ffffff);
  color: var(--color-text, #111111);
  font-size: var(--text-body, 15px);
  line-height: 1.5;
  padding: var(--spacing-md, 16px);
}
img{max-width:100%}
</style></head><body>
${html}
</body></html>`;
}

export function MockupPreview({ screens, tokensCss }: MockupPreviewProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  if (!tokensCss || screens.length === 0) return null;
  const mobile = device === 'mobile';
  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Device toggle — same grammar as the design canvas. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {(['desktop', 'mobile'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              aria-label={d}
              style={{
                padding: '5px 10px', display: 'inline-flex', alignItems: 'center',
                background: device === d ? 'var(--surface)' : 'transparent',
                color: device === d ? 'var(--text)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer',
              }}
            >
              {d === 'desktop' ? <Monitor size={13} /> : <Smartphone size={13} />}
            </button>
          ))}
        </div>
      </div>
      {screens.map((s, i) => (
        <figure
          key={`${s.name}-${i}`}
          style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          <div style={{
            width: mobile ? 390 : '100%',
            maxWidth: '100%',
            border: '1px solid var(--border)',
            borderRadius: mobile ? 18 : 'var(--radius-md)',
            overflow: 'hidden', background: '#fff',
            boxShadow: '0 1px 3px color-mix(in srgb, var(--text) 8%, transparent)',
          }}>
            <iframe
              title={`Mockup: ${s.name}`}
              srcDoc={buildSrcDoc(tokensCss, s.html)}
              sandbox=""
              style={{
                width: '100%',
                height: mobile ? 640 : 'min(68vh, 720px)',
                border: 'none', display: 'block', background: '#fff',
              }}
            />
          </div>
          <figcaption style={{
            fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600,
            textAlign: 'center',
          }}>
            This is how it'll look: {s.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
