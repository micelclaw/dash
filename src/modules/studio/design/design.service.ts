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

// ─── Design mode — module API client + canvas document utils ─────────

import { api } from '@/services/api';

export interface DesignPage {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  variant_group: string | null;
  variant_label: string | null;
  version: number;
  html: string;
  updated_at: string;
}

export interface DesignPagesResponse {
  pages: DesignPage[];
  design_md: string | null;
  design_system: string | null;
}

export interface ElementRef {
  claw_id: number;
  tag: string;
  path: string;
  outer_html: string;
}

interface Envelope<T> { data: T }

// Generation can take minutes (3 parallel variants on a slow model) —
// match the store's long generation timeout.
const GEN_TIMEOUT = 10 * 60 * 1000;

export async function listDesignPages(projectId: string): Promise<DesignPagesResponse> {
  const res = await api.get<Envelope<DesignPagesResponse>>(`/studio/projects/${projectId}/design/pages`);
  return res.data;
}

export async function generateInitialVariants(projectId: string, body: {
  prompt?: string; feel?: string; brand_colors?: string; design_system?: string;
  brief_answers?: Record<string, string>; direction_count?: number; critique?: boolean;
}): Promise<{ pages: DesignPage[]; design_mds: Array<{ page_id?: string; design_md: string | null }> }> {
  const res = await api.post<Envelope<{ pages: DesignPage[]; design_mds: Array<{ page_id?: string; design_md: string | null }> }>>(
    `/studio/projects/${projectId}/design/generate`, body, { timeout: GEN_TIMEOUT },
  );
  return res.data;
}

// ─── Design brief (Claude-Design-style questionnaire) ────────────────

export interface DesignBriefQuestion {
  id: string;
  question: string;
  options?: string[];
  multi?: boolean;
  rationale?: string;
}

export interface DesignTemplateMeta {
  slug: string;
  name: string;
  icon: string;
  description: string;
  suggested_screens: string[];
  /** First-party template (e.g. "Micelclaw Module") — the backend lists
   *  these first; the intro also pins them to the front of the row. */
  first_party?: boolean;
}

/** Structural template catalog ("Start with a template…"). */
export async function fetchDesignTemplates(): Promise<DesignTemplateMeta[]> {
  const res = await api.get<Envelope<{ templates: DesignTemplateMeta[] }>>('/studio/design-templates');
  return res.data.templates ?? [];
}

/** Full template incl. the curated starter page (for instant preview). */
export async function fetchDesignTemplate(slug: string): Promise<DesignTemplateMeta & { starter_html: string | null; brief_hint: string }> {
  const res = await api.get<Envelope<{ template: DesignTemplateMeta & { starter_html: string | null; brief_hint: string } }>>(
    `/studio/design-templates/${encodeURIComponent(slug)}`,
  );
  return res.data.template;
}

/** LLM-tailored questionnaire (visual questions + the fixed functional
 *  block). Can take ~15-30s — the caller shows a skeleton. */
export async function fetchBriefQuestions(projectId: string, template?: string | null): Promise<DesignBriefQuestion[]> {
  const res = await api.post<Envelope<{ questions: DesignBriefQuestion[] }>>(
    `/studio/projects/${projectId}/design/brief-questions`,
    { template: template ?? undefined },
    { timeout: GEN_TIMEOUT },
  );
  return res.data.questions ?? [];
}

export async function selectDesignVariant(projectId: string, pageId: string, designMd?: string | null): Promise<DesignPage[]> {
  const res = await api.post<Envelope<{ pages: DesignPage[] }>>(
    `/studio/projects/${projectId}/design/select-variant`,
    { page_id: pageId, design_md: designMd ?? undefined },
  );
  return res.data.pages;
}

/** One-click "Add screen" suggestions scanned from the concept doc
 *  (cheap server-side regex, no LLM). Empty for design-only projects. */
export async function fetchScreenSuggestions(projectId: string): Promise<string[]> {
  const res = await api.get<Envelope<{ suggestions: string[] }>>(
    `/studio/projects/${projectId}/design/screen-suggestions`,
  );
  return res.data.suggestions ?? [];
}

export async function createDesignPage(projectId: string, name: string, brief?: string): Promise<{ page_id: string; pages: DesignPage[]; fallback: boolean }> {
  const res = await api.post<Envelope<{ page_id: string; pages: DesignPage[]; fallback: boolean }>>(
    `/studio/projects/${projectId}/design/pages`, { name, brief }, { timeout: GEN_TIMEOUT },
  );
  return res.data;
}

export async function editDesignPage(projectId: string, pageId: string, body: {
  instruction: string; element?: ElementRef | null; apply_all?: boolean;
}): Promise<{ applied: Array<{ page_id: string; version: number }>; pages: DesignPage[] }> {
  const res = await api.post<Envelope<{ applied: Array<{ page_id: string; version: number }>; pages: DesignPage[] }>>(
    `/studio/projects/${projectId}/design/pages/${pageId}/edit`,
    { instruction: body.instruction, element: body.element ?? undefined, apply_all: body.apply_all },
    { timeout: GEN_TIMEOUT },
  );
  return res.data;
}

export async function saveDeterministicVersion(projectId: string, pageId: string, html: string, element?: ElementRef | null): Promise<number> {
  const res = await api.post<Envelope<{ version: number }>>(
    `/studio/projects/${projectId}/design/pages/${pageId}/versions`,
    { html, element: element ?? undefined },
  );
  return res.data.version;
}

export async function listDesignVersions(projectId: string, pageId: string): Promise<Array<{ version: number; source: string; instruction: string | null; created_at: string }>> {
  const res = await api.get<Envelope<{ versions: Array<{ version: number; source: string; instruction: string | null; created_at: string }> }>>(
    `/studio/projects/${projectId}/design/pages/${pageId}/versions`,
  );
  return res.data.versions;
}

export async function revertDesignVersion(projectId: string, pageId: string, version: number): Promise<number> {
  const res = await api.post<Envelope<{ version: number }>>(
    `/studio/projects/${projectId}/design/pages/${pageId}/revert`, { version },
  );
  return res.data.version;
}

export async function deleteDesignPage(projectId: string, pageId: string): Promise<DesignPage[]> {
  const res = await api.delete<Envelope<{ pages: DesignPage[] }>>(
    `/studio/projects/${projectId}/design/pages/${pageId}`,
  );
  return res.data.pages;
}

export async function updateDesignTokens(projectId: string, colors: Record<string, string>): Promise<string> {
  const res = await api.post<Envelope<{ design_md: string }>>(
    `/studio/projects/${projectId}/design/tokens`, { colors },
  );
  return res.data.design_md;
}

export async function fetchProjectTokensCss(projectId: string): Promise<string | null> {
  try {
    const res = await api.get<Envelope<{ tokens_css: string }>>(`/studio/projects/${projectId}/design-tokens`);
    return res.data.tokens_css || null;
  } catch {
    return null;
  }
}

export type ConvertTarget = 'micelclaw_app' | 'website' | 'webapp' | 'mobile';

/** Convert the design into a buildable project of the chosen target.
 *  micelclaw_app → Foundation (full app w/ backend); website → Packaging
 *  (pages ARE the site, publish directly); webapp/mobile → Build (the
 *  pages become a React SPA / installable PWA). Can take 30-90s (one-shot
 *  concept derivation) — callers show progress. */
export async function continueBuildInStudio(projectId: string, target: ConvertTarget = 'micelclaw_app'): Promise<{ status: string }> {
  const res = await api.post<Envelope<{ status: string }>>(
    `/studio/projects/${projectId}/design/continue-build`,
    { target },
    { timeout: GEN_TIMEOUT },
  );
  return res.data;
}

// ─── Publishing (T2 — static vhost via Caddy + PowerDNS wildcard) ────

export interface SystemDomainOption {
  id: string;
  domain: string;
  is_primary: boolean;
  enabled: boolean;
}

export async function listUserDomains(): Promise<SystemDomainOption[]> {
  const res = await api.get<Envelope<SystemDomainOption[]>>('/network/domains');
  return (res.data ?? []).filter((d) => d.enabled);
}

export interface PublishedSiteInfo {
  id: string;
  host: string;
  status: string;
  current_release: number;
}

export async function getProjectSite(projectId: string): Promise<PublishedSiteInfo | null> {
  const res = await api.get<Envelope<{ site: PublishedSiteInfo | null }>>(`/studio/projects/${projectId}/publish-site`);
  return res.data.site;
}

export async function publishProjectSite(projectId: string, body: {
  system_domain_id: string; subdomain: string; spa_fallback?: boolean;
}): Promise<{ id: string; host: string; url: string; release: number }> {
  const res = await api.post<Envelope<{ id: string; host: string; url: string; release: number }>>(
    `/studio/projects/${projectId}/publish-site`, body, { timeout: 120_000 },
  );
  return res.data;
}

export async function unpublishSite(siteId: string): Promise<void> {
  await api.delete(`/studio/published-sites/${siteId}`);
}

// ─── Canvas document construction ─────────────────────────────────────

/** Build the srcDoc for the canvas iframe: the (server-sanitized) page
 *  HTML + OUR CSP meta + the tokens layer + the nonce'd inspector script.
 *  The iframe is sandbox="allow-scripts" (opaque origin, no cookies);
 *  the CSP is the second wall: nothing loads, nothing executes except
 *  the inspector. */
export function buildCanvasDoc(opts: {
  pageHtml: string;
  tokensCss: string | null;
  overridesCss?: string | null;
  inspectorScript: string;
  nonce: string;
}): string {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'nonce-${opts.nonce}'">`;
  const tokensLayer = `<style id="claw-tokens">${opts.tokensCss ?? ''}</style>`;
  const overridesLayer = `<style id="claw-token-overrides">${opts.overridesCss ?? ''}</style>`;
  const script = `<script nonce="${opts.nonce}">${opts.inspectorScript}</script>`;

  let html = opts.pageHtml;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${csp}${tokensLayer}`);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html([^>]*)>/i, `<html$1><head>${csp}${tokensLayer}</head>`);
  } else {
    html = `<!doctype html><html><head>${csp}${tokensLayer}</head><body>${html}</body></html>`;
  }
  // Overrides AFTER the page's own <style> so knob changes win the cascade.
  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${overridesLayer}</head>`);
  }
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${script}</body>`);
  } else {
    html += script;
  }
  return html;
}

/** Deterministic text patch — NO LLM. Reproduces the inspector's pre-order
 *  numbering (body.querySelectorAll('*') document order) with DOMParser,
 *  swaps the element's text, and serializes the full document back. */
export function patchElementText(pageHtml: string, clawId: number, newText: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(pageHtml, 'text/html');
    const els = doc.body.querySelectorAll('*');
    const el = els[clawId];
    if (!el) return null;
    el.textContent = newText;
    const doctype = /^\s*<!doctype/i.test(pageHtml) ? '<!doctype html>\n' : '';
    return doctype + doc.documentElement.outerHTML;
  } catch {
    return null;
  }
}
