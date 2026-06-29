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

// ─── Studio S4 Fase C — visual preview of a design system ────────────
//
// "Así se verá tu marca" (§3.4 — bocetos reales). Given a catalog slug,
// fetches the derived tokens CSS (GET /studio/design-systems/:slug/tokens)
// and renders, INSIDE A SANDBOXED IFRAME, a swatch of the palette plus a
// sample button/card/typography styled with the `var(--…)` custom
// properties. The iframe is mandatory for style ISOLATION: injecting a
// `:root { --color-* }` block into the dash would clobber the dash theme.
// The tokens come from our vendored catalog (not user input); the iframe
// renders static HTML+CSS only (no `allow-scripts`), so there's no XSS
// surface. Closes pending-debt V3-1b(a).

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { useStudioStore } from '@/stores/studio.store';

interface DesignPreviewProps {
  slug: string;
  /** S4 Fase C — user color overrides ({ "primary": "#ff0000", … }). The
   *  preview re-renders live with these; the parent folds them into the
   *  Frontend generation context so the emitted DESIGN.md honors them. */
  overrides?: Record<string, string>;
  onOverride?: (name: string, value: string) => void;
  onResetOverrides?: () => void;
}

// The handful of tokens worth exposing as editable (the ones the sample +
// most UIs lean on). Only those PRESENT in the system + a 6-digit hex (what
// <input type="color"> can represent) become editable.
const KEY_COLOR_NAMES = ['primary', 'bg', 'background', 'surface', 'text', 'on-primary', 'border', 'accent'];
const HEX6 = /^#[0-9a-f]{6}$/i;

/** Pull `--color-<name>: <value>;` pairs out of the derived CSS so we can
 *  label the palette swatches without a second API call. */
function extractColors(tokensCss: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  const re = /--color-([a-z0-9-]+):\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tokensCss)) !== null) {
    out.push({ name: m[1], value: m[2].trim() });
  }
  return out;
}

/** Build the sandboxed document. Uses var() with sensible fallbacks so the
 *  sample renders regardless of which exact tokens a system declares. The
 *  override block comes LAST so the user's tweaks win the cascade. */
function buildSrcDoc(tokensCss: string, overrides: Record<string, string>): string {
  const ov = Object.entries(overrides)
    .filter(([, v]) => HEX6.test(v))
    .map(([k, v]) => `  --color-${k}: ${v};`)
    .join('\n');
  const overrideCss = ov ? `:root {\n${ov}\n}` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${tokensCss}
${overrideCss}
html,body{margin:0;padding:0}
body{
  font-family: var(--font-body, system-ui, sans-serif);
  background: var(--color-bg, #ffffff);
  color: var(--color-text, #111111);
  padding: 16px;
}
* { box-sizing: border-box; }
.h { font-family: var(--font-heading, var(--font-body, system-ui)); font-weight: var(--font-weight-heading, 700); font-size: var(--text-heading, 22px); line-height: var(--leading-heading, 1.2); margin: 0 0 6px; }
.muted { color: var(--color-text-muted, #6b7280); font-size: var(--text-small, 13px); margin: 0 0 14px; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.btn-primary {
  background: var(--color-primary, #2563eb);
  color: var(--color-on-primary, #ffffff);
  border: none; cursor: default;
  padding: 9px 16px; font-size: 14px; font-weight: 600;
  border-radius: var(--radius-md, 8px);
  font-family: inherit;
}
.btn-ghost {
  background: transparent;
  color: var(--color-primary, #2563eb);
  border: 1px solid var(--color-border, #d1d5db);
  padding: 8px 15px; font-size: 14px; font-weight: 600;
  border-radius: var(--radius-md, 8px);
  font-family: inherit;
}
.card {
  background: var(--color-surface, var(--color-bg, #ffffff));
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-lg, var(--radius-md, 12px));
  padding: 14px; max-width: 320px;
}
.card .price { color: var(--color-primary, #2563eb); font-weight: 700; }
.chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background: var(--color-accent-soft, var(--color-surface, #eef2ff)); color: var(--color-primary, #2563eb); }
.input { width:100%; padding:8px 10px; border:1px solid var(--color-border, #d1d5db); border-radius: var(--radius-sm, 6px); font-size:14px; font-family:inherit; color: var(--color-text, #111); background: var(--color-bg, #fff); }
.label { font-size: var(--text-label, 13px); font-weight: var(--font-weight-label, 600); margin-bottom: 4px; display:block; }
</style></head><body>
<div class="h">Tu app de ejemplo</div>
<div class="muted">Así combinan los colores, la tipografía y las formas.</div>
<div class="row">
  <button class="btn-primary">Reservar</button>
  <button class="btn-ghost">Cancelar</button>
  <span class="chip">NUEVO</span>
</div>
<div class="card">
  <div style="font-weight:600;margin-bottom:6px">Mechas · <span class="price">45 €</span></div>
  <label class="label">Tu nombre</label>
  <input class="input" value="Marta" readonly />
</div>
</body></html>`;
}

export function DesignPreview({ slug, overrides = {}, onOverride, onResetOverrides }: DesignPreviewProps) {
  const fetchDesignSystemTokens = useStudioStore((s) => s.fetchDesignSystemTokens);
  const [tokensCss, setTokensCss] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTokensCss(null);
    setError(false);
    fetchDesignSystemTokens(slug)
      .then((css) => { if (!cancelled) setTokensCss(css); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [slug, fetchDesignSystemTokens]);

  const colors = useMemo(() => (tokensCss ? extractColors(tokensCss) : []), [tokensCss]);
  const srcDoc = useMemo(() => (tokensCss ? buildSrcDoc(tokensCss, overrides) : ''), [tokensCss, overrides]);
  const hasOverrides = Object.keys(overrides).length > 0;
  const canEdit = Boolean(onOverride);

  if (error) {
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: 8 }}>
        No pude cargar la vista previa de «{slug}».
      </div>
    );
  }
  if (!tokensCss) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)', padding: 12 }}>
        <Loader2 size={14} className="animate-spin" /> Preparando la vista previa…
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--card)' }}>
      <div style={{ padding: '8px 12px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Así se verá tu marca {canEdit && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· ajusta los colores</span>}</span>
        {canEdit && hasOverrides && (
          <button
            type="button"
            onClick={() => onResetOverrides?.()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: 0, fontFamily: 'inherit' }}
          >
            <RotateCcw size={12} /> Restablecer
          </button>
        )}
      </div>
      {/* Palette swatches — KEY hex colors become editable color inputs. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 12 }}>
        {colors.slice(0, 12).map((c) => {
          const value = overrides[c.name] ?? c.value;
          const editable = canEdit && KEY_COLOR_NAMES.includes(c.name) && HEX6.test(c.value);
          return (
            <div key={c.name} title={`${c.name}: ${value}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 52 }}>
              {editable ? (
                <input
                  type="color"
                  aria-label={`Color ${c.name}`}
                  value={HEX6.test(value) ? value : c.value}
                  onChange={(e) => onOverride?.(c.name, e.target.value)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${overrides[c.name] ? 'var(--amber)' : 'var(--border)'}`, padding: 0, cursor: 'pointer', background: 'none' }}
                />
              ) : (
                <span style={{ width: 28, height: 28, borderRadius: 6, background: value, border: '1px solid var(--border)', boxSizing: 'border-box' }} />
              )}
              <span style={{ fontSize: '0.6rem', color: overrides[c.name] ? 'var(--text)' : 'var(--text-muted)', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            </div>
          );
        })}
      </div>
      {/* Sample component — isolated iframe (no allow-scripts). */}
      <iframe
        title={`Vista previa de ${slug}`}
        srcDoc={srcDoc}
        sandbox=""
        style={{ width: '100%', height: 280, border: 'none', display: 'block', background: '#fff' }}
      />
    </div>
  );
}
