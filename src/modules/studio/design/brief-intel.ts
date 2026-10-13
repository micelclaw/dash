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

// ─── Brief readers (unified funnel, ADR-18) ─────────────────────────
//
// Client-side mirrors of the server's mapIntakeToScope readers over the
// STABLE option texts of the fixed functional block (fn_*). The server stays
// authoritative at Continue — these only drive the UI (agreement card chips,
// no-UI branch, target recommendation preview). Precedent: the old
// designNeedsBackend helper.
//
// Regla del espejo: se PORTAN los lectores del servidor
// (`matchOption` + `readFn*` de core/src/studio/prompts/design-brief.ts), no
// se inventan regex parecidas. Las regex propias ya derivaron dos veces y el
// dash recomendaba un destino que el servidor no iba a construir — se midió:
// 939 desacuerdos en 7559 combinaciones, todos con respuestas de TEXTO LIBRE
// (el chip «+ Other»), p.ej. fn_integrations = «sensors on the balcony» daba
// aquí `micelclaw_app` y en el servidor `webapp`. El acuerdo lo vigila
// core/src/studio/services/__tests__/intake-scope-dash-mirror.test.ts, que
// importa las opciones REALES del servidor y corre las dos implementaciones.

import type { StudioProject } from '@/stores/studio.store';

export type BriefAnswers = Record<string, string>;

export function briefAnswers(project: Pick<StudioProject, 'design_brief'>): BriefAnswers {
  return (project.design_brief?.answers ?? {}) as BriefAnswers;
}

// Textos CONGELADOS del bloque funcional — copia byte a byte de
// FN_*_OPTIONS en core/src/studio/prompts/design-brief.ts.
const FN_SHAPE_OPTIONS = {
  app: 'An app with its own screens',
  site: 'A website or landing page',
  dashboard: 'A dashboard of data or metrics',
  automation: 'An automation that runs by itself',
  agent: 'A new skill for my AI assistant',
  service: 'Runs or controls another program',
} as const;

const FN_DATA_OPTIONS = {
  no: 'No — it just shows a screen',
  simple: 'Yes — lists, records or notes',
  series: 'Yes — readings or metrics over time',
  files: 'Yes — files or media too',
} as const;

const FN_INTEGRATIONS_OPTIONS = {
  no: 'No, self-contained',
  api: 'Yes — an external API or service',
  container: 'Yes — runs another program (Docker)',
  devices: 'Yes — devices or sensors',
} as const;

const FN_PLACE_OPTIONS = {
  os: 'Inside my OS, next to my other modules',
  web: 'On the public web',
  phone: 'Mostly on my phone',
  browser: 'In any browser',
} as const;

/** Puerto de `matchOption` (core): igualdad exacta y, si no, la opción más
 *  larga que contenga o esté contenida en la respuesta. */
function matchOption<T extends Record<string, string>>(opts: T, answer: string | undefined): keyof T | null {
  if (!answer) return null;
  const a = answer.trim().toLowerCase();
  for (const [key, text] of Object.entries(opts)) {
    if (a === text.toLowerCase()) return key as keyof T;
  }
  let best: keyof T | null = null;
  let bestLen = 0;
  for (const [key, text] of Object.entries(opts)) {
    const t = text.toLowerCase();
    if ((a.includes(t) || t.includes(a)) && t.length > bestLen) { best = key as keyof T; bestLen = t.length; }
  }
  return best;
}

function readShape(answers: BriefAnswers): keyof typeof FN_SHAPE_OPTIONS | null {
  return matchOption(FN_SHAPE_OPTIONS, answers.fn_shape);
}

function readPlace(answers: BriefAnswers): keyof typeof FN_PLACE_OPTIONS | null {
  return matchOption(FN_PLACE_OPTIONS, answers.fn_place);
}

/** Texto libre que no empieza por «no» ⇒ recuerda cosas (`simple`), igual
 *  que `readFnData` core-side. */
function readData(answers: BriefAnswers): keyof typeof FN_DATA_OPTIONS | null {
  const raw = answers.fn_data;
  const matched = matchOption(FN_DATA_OPTIONS, raw);
  if (matched) return matched;
  if (raw && raw.trim() && !/^\s*no\b/i.test(raw)) return 'simple';
  return null;
}

/** Texto libre que no empieza por «no» ⇒ API externa (`api`), igual que
 *  `readFnIntegrations` core-side. Ojo: `api` NO implica backend propio. */
function readIntegrations(answers: BriefAnswers): keyof typeof FN_INTEGRATIONS_OPTIONS | null {
  const raw = answers.fn_integrations;
  const matched = matchOption(FN_INTEGRATIONS_OPTIONS, raw);
  if (matched) return matched;
  if (raw && raw.trim() && !/^\s*no\b/i.test(raw)) return 'api';
  return null;
}

/** fn_shape: automation / agent-skill ⇒ the project needs NO screens. */
export function briefNeedsUi(answers: BriefAnswers): boolean {
  const shape = readShape(answers);
  return shape !== 'automation' && shape !== 'agent';
}

/** Data / integrations ⇒ needs its own backend (only the OS module has one).
 *
 *  Espejo EXACTO de `needsBackend` en `mapIntakeToScope` (core,
 *  design-studio.service.ts): needsDatabase || needsDocker || needsHardware ||
 *  needsAgentSkill || needsAutomation || needsTimeseries. `needsExternalApi`
 *  NO entra: un API externo es un fetch, no obliga a tener backend propio. */
export function briefNeedsBackend(answers: BriefAnswers): boolean {
  const shape = readShape(answers);
  const data = readData(answers);
  const integ = readIntegrations(answers);

  let needsDatabase = shape === 'dashboard';
  let needsTimeseries = shape === 'dashboard';
  let needsDocker = shape === 'service';
  let needsHardware = false;
  const needsAutomation = shape === 'automation';
  const needsAgentSkill = shape === 'agent';

  if (data === 'simple' || data === 'files') needsDatabase = true;
  else if (data === 'series') { needsDatabase = true; needsTimeseries = true; }
  else if (data === 'no' && shape !== 'dashboard') needsDatabase = false;

  if (integ === 'container') needsDocker = true;
  else if (integ === 'devices') needsHardware = true;

  return needsDatabase || needsDocker || needsHardware || needsAgentSkill || needsAutomation || needsTimeseries;
}

export type RecommendedTarget = 'micelclaw_app' | 'website' | 'webapp' | 'mobile';

/** Mirror of the server's recommendation: backend need ALWAYS wins toward
 *  the OS module; otherwise fn_shape site / fn_place decide. */
export function briefRecommendedTarget(answers: BriefAnswers): RecommendedTarget {
  if (briefNeedsBackend(answers)) return 'micelclaw_app';
  const shape = readShape(answers);
  const place = readPlace(answers);
  if (shape === 'site' || place === 'web') return 'website';
  if (place === 'phone') return 'mobile';
  if (place === 'browser') return 'webapp';
  return 'micelclaw_app';
}

/** Plain-words rationale for the recommendation (R-A: no jargon). */
export function briefRecommendationReason(answers: BriefAnswers): string {
  const shape = readShape(answers);
  if (shape === 'automation') return 'An automation lives inside your OS and runs on its own.';
  if (shape === 'agent') return 'A new skill for your assistant lives inside your OS.';
  if (briefNeedsBackend(answers)) return 'You said it needs to remember things — an app in your OS gets its own memory.';
  const place = readPlace(answers);
  if (place === 'web') return 'You said it lives on the public web.';
  if (place === 'phone') return 'You said you\'ll use it mostly on your phone.';
  if (place === 'browser') return 'You said you\'ll use it from any browser.';
  return 'It fits right in with your other modules.';
}

/** The agreement card rows — plain-words chips from what was answered.
 *  Unanswered → honest "I'll decide" copy, never invented facts. */
export function briefAgreementRows(answers: BriefAnswers, opts?: { layoutName?: string | null; styleName?: string | null }): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const needsUi = briefNeedsUi(answers);
  rows.push({
    label: 'What it is',
    value: answers.fn_shape || 'An app with its own screens (my guess — change it above)',
  });
  rows.push({
    label: 'It remembers',
    value: answers.fn_data
      ? answers.fn_data.replace(/^Yes — /i, '').replace(/^No — .*/i, 'Nothing — it just shows things')
      : 'I\'ll decide from your idea',
  });
  rows.push({
    label: 'It connects to',
    value: answers.fn_integrations
      ? answers.fn_integrations.replace(/^Yes — /i, '').replace(/^No.*/i, 'Nothing — self-contained')
      : 'Nothing that you mentioned',
  });
  rows.push({
    label: 'Screens',
    value: needsUi ? 'Its own screens — we design them next' : 'None — it works quietly behind the scenes',
  });
  rows.push({ label: 'Who it\'s for', value: answers.fn_audience || 'You' });
  if (needsUi && (opts?.layoutName || opts?.styleName)) {
    rows.push({
      label: 'The look',
      value: [opts?.layoutName, opts?.styleName].filter(Boolean).join(' · '),
    });
  }
  if (answers.fn_notes?.trim()) {
    rows.push({ label: 'Notes', value: answers.fn_notes.trim().slice(0, 240) });
  }
  return rows;
}
