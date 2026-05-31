/**
 * Generates the Markdown report for the tool-calls-roundtrip test.
 *
 * Produces a 6-section report:
 *   §1 Resumen ejecutivo (verdict + headline latencies)
 *   §2 Galería de screenshots (inline images with captions)
 *   §3 Cadena de eventos detallada (wide table, every event from every source)
 *   §4 Matriz de latencias por etapa (pipeline lag per key event)
 *   §5 Lado a lado OpenClaw ↔ Micelclaw (synthesized JSONL view vs dash screenshots)
 *   §6 DB raw dump
 */

import { readdir, writeFile, mkdir } from 'fs/promises';
import type { TimelineRecorder, TimelineEvent } from './timeline-recorder.js';
import type { OcViewBlock } from './openclaw-view.js';

export interface Assertion {
  description: string;
  passed: boolean;
  detail?: string;
  warning?: boolean;
}

export interface ScreenshotEntry {
  /** Two-digit index e.g. "01" */
  index: string;
  /** File name (e.g. 01-prompt-sent-t6s.png) */
  filename: string;
  /** Caption: what this captures + Δt from submit + ref event */
  caption: string;
  /** Δt from submit (ms) when shot was taken */
  deltaFromSubmit?: number;
  /** Optional anchor in the events chain (delta range to link with) */
  linkedEventDelta?: number;
}

export interface LatencyRow {
  event: string;
  ocJsonl?: number | null;
  mirror?: number | null;
  db?: number | null;
  ws?: number | null;
  dom?: number | null;
}

export interface DbRawRow {
  conversation_id: string;
  role: string;
  from_agent: string;
  n_tools: number;
  message_preview: string;
  created_at: string;
}

export interface ReportInput {
  reportPath: string;
  screenshotsDir: string;
  screenshotsRelative: string;
  prompt: string;
  recorder: TimelineRecorder;
  assertions: Assertion[];
  /** Submitted prompt t0 (Date.now() at submit). Used to normalize timeline. */
  submitT0?: number;
  /** Manually curated screenshot gallery entries (in order). */
  screenshots?: ScreenshotEntry[];
  /** Pipeline latency matrix per key event. */
  latencyMatrix?: LatencyRow[];
  /** Headline metrics for §1. */
  headlineMetrics?: Array<{ label: string; value: string; verdict: '✅' | '❌' | '⚠️' }>;
  /** OpenClaw views for §5. */
  ocFrancisBlocks?: OcViewBlock[];
  ocSentinelBlocks?: OcViewBlock[];
  /** Raw DB rows for §6. */
  dbRows?: DbRawRow[];
  /** Optional extra notes block at the end. */
  notes?: string;
}

function formatDelta(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(2)}s`;
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ⏎ ');
}

function formatTimelineRow(ev: TimelineEvent): string {
  const tool = ev.meta?.tool_id ? String(ev.meta.tool_id) : '';
  const shot = ev.meta?.screenshot ? String(ev.meta.screenshot) : '';
  return `| ${formatDelta(ev.delta)} | ${ev.source} | ${escapePipes(ev.description)} | ${tool} | ${shot} |`;
}

function formatLatencyCell(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return formatDelta(v);
}

function formatLatencyRow(r: LatencyRow): string {
  const cells = [
    r.event,
    formatLatencyCell(r.ocJsonl),
    formatLatencyCell(r.mirror),
    formatLatencyCell(r.db),
    formatLatencyCell(r.ws),
    formatLatencyCell(r.dom),
  ];
  return `| ${cells.join(' | ')} |`;
}

function ocColumn(blocks: OcViewBlock[] | undefined): string {
  if (!blocks || blocks.length === 0) return '_(no JSONL data)_';
  return blocks.map((b) => {
    const dt = b.deltaFromT0 > 0 ? `**+${(b.deltaFromT0 / 1000).toFixed(1)}s**` : '_(no ts)_';
    return `${dt}\n\n${b.markdown}`;
  }).join('\n\n---\n\n');
}

export async function writeReport(input: ReportInput): Promise<void> {
  const {
    reportPath,
    screenshotsDir,
    screenshotsRelative,
    prompt,
    recorder,
    assertions,
    screenshots: manualScreenshots,
    latencyMatrix,
    headlineMetrics,
    ocFrancisBlocks,
    ocSentinelBlocks,
    dbRows,
    notes,
  } = input;

  const parent = reportPath.substring(0, reportPath.lastIndexOf('/'));
  if (parent) await mkdir(parent, { recursive: true });

  // Fallback: if no curated gallery, list all PNGs in dir.
  let fallbackList: string[] = [];
  if (!manualScreenshots || manualScreenshots.length === 0) {
    try {
      fallbackList = (await readdir(screenshotsDir)).filter((f) => /\.png$/i.test(f)).sort();
    } catch {
      /* no dir */
    }
  }

  const critical = assertions.filter((a) => !a.warning);
  const passed = critical.filter((a) => a.passed).length;
  const total = critical.length;
  const overall = passed === total ? '✅ PASS' : `❌ FAIL — ${passed}/${total} críticas`;

  const assertionRows = assertions
    .map((a) => {
      const icon = a.passed ? '✅' : (a.warning ? '⚠️' : '❌');
      return `- ${icon} ${a.description}${a.detail ? ` — ${a.detail}` : ''}`;
    })
    .join('\n');

  // ─── §1 Resumen ────────────────────────────────────────────────
  const headlineRows = (headlineMetrics ?? []).map((m) => `| ${m.label} | ${m.value} | ${m.verdict} |`).join('\n');

  // ─── §2 Galería ────────────────────────────────────────────────
  const gallery: string[] = [];
  if (manualScreenshots && manualScreenshots.length > 0) {
    for (const s of manualScreenshots) {
      const dt = s.deltaFromSubmit !== undefined ? ` _(t=${formatDelta(s.deltaFromSubmit)})_` : '';
      gallery.push(`### ${s.index} · ${s.caption}${dt}\n`);
      gallery.push(`![${s.filename}](${screenshotsRelative.replace(/\/$/, '')}/${s.filename})\n`);
    }
  } else if (fallbackList.length > 0) {
    for (const f of fallbackList) {
      gallery.push(`### ${f}\n`);
      gallery.push(`![${f}](${screenshotsRelative.replace(/\/$/, '')}/${f})\n`);
    }
  } else {
    gallery.push('_(no screenshots captured)_');
  }

  // ─── §3 Cadena de eventos ──────────────────────────────────────
  const timelineRows = recorder.all().map(formatTimelineRow).join('\n');

  // ─── §4 Matriz de latencias ────────────────────────────────────
  const latencyTable = (latencyMatrix && latencyMatrix.length > 0)
    ? [
        `| Evento clave | OC JSONL | Mirror | DB row | WS event | Dash DOM |`,
        `|---|---|---|---|---|---|`,
        ...latencyMatrix.map(formatLatencyRow),
      ].join('\n')
    : '_(no pipeline latencies computed)_';

  // ─── §5 Lado a lado ────────────────────────────────────────────
  const sideBySide = [
    `### Francis — OpenClaw JSONL (Δt desde submit)`,
    ``,
    ocColumn(ocFrancisBlocks),
    ``,
    `### Sentinel — OpenClaw JSONL (Δt desde submit)`,
    ``,
    ocColumn(ocSentinelBlocks),
  ].join('\n');

  // ─── §6 DB raw ─────────────────────────────────────────────────
  const dbTable = (dbRows && dbRows.length > 0)
    ? [
        `| conv_id | role | from_agent | n_tools | message | created_at |`,
        `|---|---|---|---|---|---|`,
        ...dbRows.map((r) => `| ${r.conversation_id.slice(0, 8)}… | ${r.role} | ${r.from_agent} | ${r.n_tools} | ${escapePipes(r.message_preview.slice(0, 100))} | ${r.created_at.slice(0, 19)} |`),
      ].join('\n')
    : '_(no DB rows captured)_';

  const md = [
    `# Tool Calls Roundtrip — Reporte Detallado`,
    ``,
    `**Status:** ${overall}`,
    `**Prompt:** \`${prompt}\``,
    `**Test wall time:** ${(recorder.elapsed() / 1000).toFixed(2)}s`,
    `**Generated:** ${new Date().toISOString()}`,
    ``,
    `---`,
    ``,
    `## §1 · Resumen ejecutivo`,
    ``,
    headlineRows ? `| Métrica | Valor | Verdict |\n|---|---|---|\n${headlineRows}` : '_(no metrics)_',
    ``,
    `### Assertions`,
    ``,
    assertionRows || '_(none)_',
    ``,
    `---`,
    ``,
    `## §2 · Galería de capturas`,
    ``,
    gallery.join('\n'),
    ``,
    `---`,
    ``,
    `## §3 · Cadena de eventos detallada`,
    ``,
    `| Δt | Fuente | Detalle | Tool ID | Screenshot |`,
    `|---|---|---|---|---|`,
    timelineRows || '| _(no events)_ |  |  |  |  |',
    ``,
    `---`,
    ``,
    `## §4 · Matriz de latencias por etapa`,
    ``,
    `Cada fila muestra cuándo apareció el evento en cada capa del pipeline. Δt está medido desde el momento en que el usuario envió el prompt.`,
    ``,
    latencyTable,
    ``,
    `---`,
    ``,
    `## §5 · Lado a lado · OpenClaw ↔ Micelclaw`,
    ``,
    `Vista sintetizada del JSONL crudo de OpenClaw (lo que el agente "ve" internamente). Comparar con las capturas de §2 alineadas por Δt.`,
    ``,
    sideBySide,
    ``,
    `---`,
    ``,
    `## §6 · DB raw dump`,
    ``,
    dbTable,
    ``,
    notes ? `---\n\n## Notas\n\n${notes}\n` : '',
  ].join('\n');

  await writeFile(reportPath, md, 'utf-8');
}
