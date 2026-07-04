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

// ─── Studio A3 — Open Design real previews: visual parsing ──────────
//
// The Frontend doc-phase prompt appends two single-line HTML comments to
// the document body (same emit-as-comment trick as the Concept "ficha"):
//
//   <!-- claw-wireframes {"screens":[{"name":"…","ascii":"…\n…"}]} -->
//   <!-- claw-mockups    {"screens":[{"name":"…","html":"<div …>…</div>"}]} -->
//
// They are COMMENTS → invisible in markdown, and absent/malformed → the UI
// falls back to the markdown body + the ```text wireframes. We parse them
// out, strip them from the text, and sanitize the mockup HTML (the iframe
// is ALREADY sandboxed; this is defense-in-depth, never the only barrier).

export interface WireframeScreen {
  name: string;
  ascii: string;
}

export interface MockupScreen {
  name: string;
  html: string;
}

export interface ParsedVisuals {
  wireframes: WireframeScreen[];
  mockups: MockupScreen[];
  /** The document body with both visual comments removed + trimmed. */
  body: string;
}

// `[\s\S]*?` is non-greedy and JSON never contains `-->`, so these capture
// the whole object (incl. nested arrays/objects) up to the comment close.
const WIREFRAMES_RE = /<!--\s*claw-wireframes\s+([\s\S]*?)\s*-->/;
const MOCKUPS_RE = /<!--\s*claw-mockups\s+([\s\S]*?)\s*-->/;

// Caps (mirror the prompt's contract; defense against runaway output).
const MAX_SCREENS = 3;
const MAX_HTML_CHARS = 2500;

// ─── Sanitizer (defense-in-depth — the iframe is sandboxed too) ─────

/** Strip anything that could execute or reach the network out of a mockup
 *  HTML fragment. The fragment is rendered in a `sandbox=""` iframe (no
 *  allow-scripts, no allow-same-origin), so this is a second layer, not the
 *  only one. We strip rather than reject so a slightly-dirty fragment still
 *  shows something instead of nothing. */
function sanitizeMockupHtml(html: string): string {
  let out = String(html);
  // Whole <script>…</script> blocks (incl. unclosed at EOF).
  out = out.replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, '');
  // <style>…</style> — CSS can exfil (e.g. background:url()) and a static
  // mockup doesn't need it. The core sanitizer strips it too (kept in parity).
  out = out.replace(/<style\b[\s\S]*?(?:<\/style\s*>|$)/gi, '');
  // <iframe>…</iframe> (and a stray opening tag).
  out = out.replace(/<iframe\b[\s\S]*?(?:<\/iframe\s*>|$)/gi, '');
  out = out.replace(/<\/?iframe\b[^>]*>/gi, '');
  // on*="…" / on*='…' / on*=bare event handlers. The boundary before `on…`
  // may be whitespace OR `/` OR a quote — browsers accept `<a/onclick=…>` as a
  // valid attribute separator, so anchoring on `\s` alone would miss it.
  out = out.replace(/([\s/"'`])on\w+\s*=\s*"[^"]*"/gi, '$1');
  out = out.replace(/([\s/"'`])on\w+\s*=\s*'[^']*'/gi, '$1');
  out = out.replace(/([\s/"'`])on\w+\s*=\s*[^\s>]+/gi, '$1');
  // javascript: URLs (tolerate whitespace/control chars inside the scheme).
  out = out.replace(/javascript\s*:/gi, '');
  // @import (CSS network fetch) — parity with the core sanitizer.
  out = out.replace(/@import/gi, '');
  return out.slice(0, MAX_HTML_CHARS);
}

function asScreenArray<T>(raw: unknown, map: (s: Record<string, unknown>) => T | null): T[] {
  if (!raw || typeof raw !== 'object') return [];
  const screens = (raw as { screens?: unknown }).screens;
  if (!Array.isArray(screens)) return [];
  const out: T[] = [];
  for (const s of screens) {
    if (!s || typeof s !== 'object') continue;
    const mapped = map(s as Record<string, unknown>);
    if (mapped) out.push(mapped);
    if (out.length >= MAX_SCREENS) break;
  }
  return out;
}

// ─── ```text fallback (when claw-wireframes is absent/empty) ─────────

const FENCED_TEXT_RE = /```text\n([\s\S]*?)```/g;

/** Extract ```text … ``` fenced blocks from the body, naming each by the
 *  nearest preceding `## …` or `**…:**` heading (default "Pantalla N"). */
function wireframesFromFencedText(body: string): WireframeScreen[] {
  const out: WireframeScreen[] = [];
  let m: RegExpExecArray | null;
  FENCED_TEXT_RE.lastIndex = 0;
  while ((m = FENCED_TEXT_RE.exec(body)) !== null && out.length < MAX_SCREENS) {
    const before = body.slice(0, m.index);
    const name = nearestHeading(before) ?? `Pantalla ${out.length + 1}`;
    const ascii = (m[1] ?? '').replace(/[\s\n]+$/, '');
    if (ascii.trim().length > 0) out.push({ name, ascii });
  }
  return out;
}

/** Find the closest preceding `## Heading` or `**Label:**` to name a block. */
function nearestHeading(before: string): string | null {
  // Last `## …` line.
  const headingMatches = [...before.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)];
  const lastHeading = headingMatches.at(-1)?.[1];
  // Last `**Label:**` / `**Label**` emphasis (often used for "Main screen:").
  const boldMatches = [...before.matchAll(/\*\*([^*\n]+?):?\*\*/g)];
  const lastBold = boldMatches.at(-1)?.[1];
  // Prefer whichever appears later in the text.
  const hIdx = lastHeading ? before.lastIndexOf(lastHeading) : -1;
  const bIdx = lastBold ? before.lastIndexOf(lastBold) : -1;
  const chosen = bIdx > hIdx ? lastBold : lastHeading;
  return chosen ? cleanHeading(chosen) : null;
}

function cleanHeading(h: string): string {
  // Drop a leading "Main screen:" / "Screen:" / "Pantalla:" prefix.
  return h.replace(/^(main\s+screen|screen|pantalla)\s*:\s*/i, '').trim() || h.trim();
}

// ─── Public API ─────────────────────────────────────────────────────

export function parseVisuals(text: string): ParsedVisuals {
  if (!text) return { wireframes: [], mockups: [], body: text };

  let body = text;
  let wireframes: WireframeScreen[] = [];
  let mockups: MockupScreen[] = [];

  const wfMatch = WIREFRAMES_RE.exec(body);
  if (wfMatch) {
    try {
      const parsed = JSON.parse(wfMatch[1] ?? '') as unknown;
      wireframes = asScreenArray<WireframeScreen>(parsed, (s) => {
        const name = typeof s.name === 'string' ? s.name.trim() : '';
        const ascii = typeof s.ascii === 'string' ? s.ascii : '';
        if (!ascii.trim()) return null;
        return { name: name || 'Pantalla', ascii };
      });
    } catch {
      wireframes = []; // malformed → treat as absent (fallback below)
    }
    body = body.slice(0, wfMatch.index) + body.slice(wfMatch.index + wfMatch[0].length);
  }

  const mkMatch = MOCKUPS_RE.exec(body);
  if (mkMatch) {
    try {
      const parsed = JSON.parse(mkMatch[1] ?? '') as unknown;
      mockups = asScreenArray<MockupScreen>(parsed, (s) => {
        const name = typeof s.name === 'string' ? s.name.trim() : '';
        const html = typeof s.html === 'string' ? sanitizeMockupHtml(s.html) : '';
        if (!html.trim()) return null;
        return { name: name || 'Pantalla', html };
      });
    } catch {
      mockups = []; // malformed → treat as absent (markdown fallback)
    }
    body = body.slice(0, mkMatch.index) + body.slice(mkMatch.index + mkMatch[0].length);
  }

  body = body.trim();

  // Wireframe fallback: no explicit comment → reuse the ```text blocks.
  if (wireframes.length === 0) {
    wireframes = wireframesFromFencedText(body);
  }

  return { wireframes, mockups, body };
}

export function hasWireframes(v: ParsedVisuals): boolean {
  return v.wireframes.length > 0;
}

export function hasMockups(v: ParsedVisuals): boolean {
  return v.mockups.length > 0;
}

// ─── Default tokens from the Guided "feel" (always-on brand preview) ─

// The 4 FEELS in DocPhaseLayout (ids must match exactly).
type FeelId = 'elegant' | 'fresh' | 'warm' | 'minimal';

interface Palette {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  border: string;
  danger: string;
  accent: string;
  fontBody: string;
  fontHeading: string;
}

const FEEL_PALETTES: Record<FeelId, Palette> = {
  elegant: {
    bg: '#ffffff', surface: '#f7f6f4', text: '#1c1b19', textMuted: '#6b6862',
    primary: '#1c1b19', onPrimary: '#ffffff', border: '#e6e3dd', danger: '#b91c1c',
    accent: '#a98f5a',
    fontBody: 'Georgia, "Times New Roman", serif',
    fontHeading: 'Georgia, "Times New Roman", serif',
  },
  fresh: {
    bg: '#ffffff', surface: '#f0fdf9', text: '#0f172a', textMuted: '#52606d',
    primary: '#0ea5e9', onPrimary: '#ffffff', border: '#d6e8e4', danger: '#dc2626',
    accent: '#f59e0b',
    fontBody: 'system-ui, "Segoe UI", sans-serif',
    fontHeading: 'system-ui, "Segoe UI", sans-serif',
  },
  warm: {
    bg: '#fffaf5', surface: '#fdf1e7', text: '#2b1d14', textMuted: '#7c6357',
    primary: '#e07a3f', onPrimary: '#ffffff', border: '#f0ddcc', danger: '#c0392b',
    accent: '#d4a017',
    fontBody: '"Nunito", system-ui, sans-serif',
    fontHeading: '"Nunito", system-ui, sans-serif',
  },
  minimal: {
    bg: '#ffffff', surface: '#fafafa', text: '#171717', textMuted: '#737373',
    primary: '#171717', onPrimary: '#ffffff', border: '#e5e5e5', danger: '#dc2626',
    accent: '#525252',
    fontBody: 'system-ui, -apple-system, sans-serif',
    fontHeading: 'system-ui, -apple-system, sans-serif',
  },
};

// Named-color overrides parsed from free-text brand input (Spanish + a few
// common ones). Each maps to a primary + a complementary accent.
const NAMED_COLORS: Record<string, { primary: string; accent: string }> = {
  rosa: { primary: '#ec4899', accent: '#f59e0b' },
  dorado: { primary: '#d4a017', accent: '#1c1b19' },
  azul: { primary: '#2563eb', accent: '#0ea5e9' },
  verde: { primary: '#16a34a', accent: '#84cc16' },
};

const HEX6_GLOBAL = /#[0-9a-fA-F]{6}/g;

/** Build a `:root { … }` tokens CSS string from the Guided "feel" id, plus
 *  any colors parsed out of the free-text brand input. Deterministic, no
 *  network — used for the ALWAYS-ON brand preview when no catalog design
 *  system is bound. Token names mirror the backend's derived tokens.css
 *  (--color-*, --spacing-*, --radius-*, --font-*, --text-*). */
export function defaultTokensFromFeel(
  feel: string | null | undefined,
  brandColors: string | null | undefined,
  projectName: string | null | undefined,
): string {
  const key: FeelId = (feel && feel in FEEL_PALETTES ? feel : 'minimal') as FeelId;
  const p: Palette = { ...FEEL_PALETTES[key] };

  // Brand-color overrides: explicit hex wins; else a known named color.
  const text = (brandColors ?? '').toLowerCase();
  const hexes = text.match(HEX6_GLOBAL);
  if (hexes && hexes.length > 0) {
    p.primary = hexes[0];
    if (hexes[1]) p.accent = hexes[1];
  } else {
    for (const [word, pair] of Object.entries(NAMED_COLORS)) {
      if (text.includes(word)) {
        p.primary = pair.primary;
        p.accent = pair.accent;
        break;
      }
    }
  }

  const lines: string[] = [':root {'];
  if (projectName) {
    lines.push(`  /* ${String(projectName).replace(/\*\//g, '')} — vista previa de marca */`);
  }
  lines.push(
    `  --color-bg: ${p.bg};`,
    `  --color-surface: ${p.surface};`,
    `  --color-text: ${p.text};`,
    `  --color-text-muted: ${p.textMuted};`,
    `  --color-primary: ${p.primary};`,
    `  --color-on-primary: ${p.onPrimary};`,
    `  --color-border: ${p.border};`,
    `  --color-danger: ${p.danger};`,
    `  --color-accent: ${p.accent};`,
    `  --spacing-sm: 8px;`,
    `  --spacing-md: 16px;`,
    `  --spacing-lg: 24px;`,
    `  --radius-sm: 6px;`,
    `  --radius-md: 10px;`,
    `  --radius-lg: 16px;`,
    `  --radius-full: 9999px;`,
    `  --font-body: ${p.fontBody};`,
    `  --font-heading: ${p.fontHeading};`,
    `  --text-heading: 22px;`,
    `  --text-body: 15px;`,
    `  --text-small: 13px;`,
    '}',
  );
  return lines.join('\n') + '\n';
}
