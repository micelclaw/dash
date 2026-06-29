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

// ─── Studio V3-4 — structured "ficha" parsing ───────────────────────
//
// The Concept/Foundation doc-phase prompts append a single-line HTML
// comment to the document body with a compact JSON summary the Guided
// UI renders as a card ("ficha-acuerdo" §3.3 / "hitos de obra" §3.5):
//
//   <!-- claw-ficha {"does":"…","includes":["…"],"excludes":["…"]} -->
//   <!-- claw-ficha {"milestones":[{"title":"…","detail":"…"}]} -->
//
// It is a COMMENT → invisible in markdown, and absent → the UI falls
// back to the markdown body. We parse it out + strip it from the text.

export interface ConceptFicha {
  does?: string;
  audience?: string;
  includes?: string[];
  excludes?: string[];
}

export interface FoundationMilestone {
  title: string;
  detail?: string;
}

export interface FoundationFicha {
  milestones?: FoundationMilestone[];
}

export type Ficha = ConceptFicha & FoundationFicha;

// `[\s\S]*?` is non-greedy and JSON never contains `-->`, so this captures
// the whole object (incl. nested arrays/objects) up to the comment close.
const FICHA_RE = /<!--\s*claw-ficha\s+([\s\S]*?)\s*-->/;

export interface ParsedFicha {
  /** Parsed ficha JSON, or null when absent / malformed. */
  ficha: Ficha | null;
  /** The document body with the ficha comment removed. */
  body: string;
}

export function parseFicha(text: string): ParsedFicha {
  if (!text) return { ficha: null, body: text };
  const m = FICHA_RE.exec(text);
  if (!m) return { ficha: null, body: text };
  let ficha: Ficha | null = null;
  try {
    const parsed = JSON.parse(m[1]) as unknown;
    if (parsed && typeof parsed === 'object') ficha = parsed as Ficha;
  } catch {
    ficha = null; // malformed → treat as absent (markdown fallback)
  }
  const body = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  return { ficha, body };
}

/** True when the ficha carries at least one renderable field for `phase`. */
export function fichaHasContent(phase: 'concept' | 'frontend' | 'foundation', ficha: Ficha | null): boolean {
  if (!ficha) return false;
  if (phase === 'foundation') return Array.isArray(ficha.milestones) && ficha.milestones.length > 0;
  // concept (frontend has no ficha today)
  return Boolean(
    ficha.does ||
    ficha.audience ||
    (Array.isArray(ficha.includes) && ficha.includes.length > 0) ||
    (Array.isArray(ficha.excludes) && ficha.excludes.length > 0),
  );
}
