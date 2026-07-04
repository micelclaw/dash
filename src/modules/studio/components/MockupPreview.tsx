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

// ─── Studio A3 — real HTML mockups ("Así se verá") ──────────────────
//
// Renders the self-contained HTML fragments the Frontend doc-phase emitted
// (parsed + sanitized by lib/mockups.ts) inside SANDBOXED iframes, each
// styled with the project's design tokens so the user SEES their app before
// it's built. The isolation approach mirrors DesignPreview.buildSrcDoc:
//   - inject the tokens CSS in <style> FIRST (so the :root vars resolve),
//   - then base resets + var() fallbacks (bg / text / font),
//   - then the sanitized fragment in <body>.
// The iframe is `sandbox=""` (NO allow-scripts, NO allow-same-origin) —
// identical to DesignPreview, so there is no script/network surface even
// though the fragment came from the model.

import type { MockupScreen } from '../lib/mockups';

interface MockupPreviewProps {
  screens: MockupScreen[];
  /** A `:root { … }` tokens CSS string (catalog system or feel-derived). */
  tokensCss: string;
}

/** Build the sandboxed document for one mockup screen. Tokens FIRST, then
 *  resets + var() fallbacks, then the sanitized fragment. Same shape as
 *  DesignPreview's buildSrcDoc (static HTML+CSS only, no allow-scripts). */
function buildSrcDoc(tokensCss: string, html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
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
  if (!tokensCss || screens.length === 0) return null;
  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {screens.map((s, i) => (
        <figure
          key={`${s.name}-${i}`}
          style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden', background: '#fff',
            boxShadow: '0 1px 3px color-mix(in srgb, var(--text) 8%, transparent)',
          }}>
            <iframe
              title={`Mockup de ${s.name}`}
              srcDoc={buildSrcDoc(tokensCss, s.html)}
              sandbox=""
              style={{ width: '100%', height: 360, border: 'none', display: 'block', background: '#fff' }}
            />
          </div>
          <figcaption style={{
            fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600,
            maxWidth: 480, textAlign: 'center',
          }}>
            Así se verá: {s.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
