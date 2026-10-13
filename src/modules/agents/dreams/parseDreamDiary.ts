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

import type { DreamEntry, ParsedDiary } from './types';

/**
 * Parser puro del DREAMS.md que escribe el dreaming de OpenClaw.
 * Formato real (verificado contra el fichero vivo):
 *   # Dream Diary
 *   <!-- openclaw:dreaming:diary:start -->
 *   ---
 *   [<!-- openclaw:dreaming:backfill-entry day=YYYY-MM-DD source=path -->]
 *   *Month D, YYYY[ at h:mm AM GMT+2]*
 *   prosa…
 *   ---
 *   …
 *   <!-- openclaw:dreaming:diary:end -->
 *   [## Deep Sleep entre <!-- openclaw:dreaming:deep:start/end --> con bullets]
 *
 * NUNCA lanza: cualquier fallo → { parse_ok:false } y la UI cae al blob <pre>.
 * Fechas locale-EN → mapa de meses hardcodeado (no Date.parse dependiente de entorno).
 */

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Variantes reales: "July 16, 2026 at 3:00 AM GMT+2" · "April 15, 2026" ·
// "Dream Diary Entry: Saturday, June 20, 2026" (prefijo + día de la semana).
const DATE_RE = /^(?:dream diary entry:\s*)?(?:[A-Za-z]+,\s+)?([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i;
const BACKFILL_RE = /<!--\s*openclaw:dreaming:backfill-entry\s+day=(\S+)\s+source=(\S+)\s*-->/;
const FRAGMENT_RE = /^(Session:|User:|Assistant:|System:)/;

function parseDateLabel(label: string): Date | null {
  const m = DATE_RE.exec(label.trim());
  if (!m) return null;
  const month = MONTHS[(m[1] ?? '').toLowerCase()];
  if (month === undefined) return null;
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hours = 0, minutes = 0;
  if (m[4]) {
    hours = Number(m[4]) % 12;
    if (/pm/i.test(m[6] ?? '')) hours += 12;
    minutes = Number(m[5]);
  }
  const d = new Date(year, month, day, hours, minutes);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(date: Date | null, fallback: string): string {
  if (!date) return fallback;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function parseDreamDiary(content: string | undefined | null): ParsedDiary {
  const empty: ParsedDiary = { entries: [], deep_sleep: [], had_markers: false, parse_ok: false };
  if (!content || typeof content !== 'string') return empty;
  try {
    // ── Sección Deep Sleep (fuera del cuerpo del diario) ──
    const deepSleep: string[] = [];
    const deepMatch = /<!--\s*openclaw:dreaming:deep:start\s*-->([\s\S]*?)<!--\s*openclaw:dreaming:deep:end\s*-->/.exec(content);
    if (deepMatch) {
      for (const line of (deepMatch[1] ?? '').split('\n')) {
        const t = line.trim();
        if (t.startsWith('- ')) deepSleep.push(t.slice(2).trim());
      }
    }

    // ── Cuerpo del diario ──
    let body = content;
    let hadMarkers = false;
    const start = content.indexOf('<!-- openclaw:dreaming:diary:start -->');
    const end = content.indexOf('<!-- openclaw:dreaming:diary:end -->');
    if (start >= 0) {
      hadMarkers = true;
      body = content.slice(start + '<!-- openclaw:dreaming:diary:start -->'.length, end > start ? end : undefined);
    } else {
      // Sin markers: todo tras la cabecera "# Dream Diary" (excluyendo Deep Sleep si aparece después)
      const header = content.indexOf('# Dream Diary');
      if (header >= 0) body = content.slice(header + '# Dream Diary'.length);
      if (deepMatch) body = body.replace(deepMatch[0], '');
    }

    const blocks = body.split(/^---\s*$/m);
    const entries: DreamEntry[] = [];
    for (const rawBlock of blocks) {
      let block = rawBlock.trim();
      if (!block) continue;

      let backfill = false;
      let backfillDay: string | undefined;
      let backfillSource: string | undefined;
      const bf = BACKFILL_RE.exec(block);
      if (bf) {
        backfill = true;
        backfillDay = bf[1];
        backfillSource = bf[2];
        block = block.replace(bf[0], '').trim();
      }
      // Otros comentarios HTML residuales fuera
      block = block.replace(/<!--[\s\S]*?-->/g, '').trim();
      if (!block) continue;

      const lines = block.split('\n');
      let dateLabel = '';
      let bodyStart = 0;
      const first = (lines[0] ?? '').trim();
      // La línea de fecha canónica es *…* (cursiva), pero algunos modelos escriben
      // **…** (negrita) — tolerar 1-2 asteriscos a cada lado.
      const dateLine = /^\*{1,2}(.+?)\*{1,2}$/.exec(first);
      if (dateLine) {
        dateLabel = (dateLine[1] ?? '').trim();
        bodyStart = 1;
      }
      const entryBody = lines.slice(bodyStart).join('\n').trim();
      if (!entryBody && !dateLabel) continue;

      const date = dateLabel ? parseDateLabel(dateLabel) : null;
      entries.push({
        id: `e${entries.length}`,
        date_label: dateLabel || '(sin fecha)',
        date,
        day_key: dayKey(date, dateLabel || 'unknown'),
        body: entryBody,
        backfill,
        backfill_day: backfillDay,
        backfill_source: backfillSource,
        fragment: FRAGMENT_RE.test(entryBody),
      });
    }

    return { entries, deep_sleep: deepSleep, had_markers: hadMarkers, parse_ok: entries.length > 0 };
  } catch {
    return empty;
  }
}

/** Agrupa entradas por día (nuevo → viejo). Las entradas dentro del día conservan el orden del fichero. */
export function groupByDay(entries: DreamEntry[]): Array<{ day_key: string; date: Date | null; label: string; entries: DreamEntry[]; has_backfill: boolean }> {
  const map = new Map<string, DreamEntry[]>();
  for (const e of entries) {
    const list = map.get(e.day_key) ?? [];
    list.push(e);
    map.set(e.day_key, list);
  }
  const groups = Array.from(map.entries()).map(([day_key, list]) => ({
    day_key,
    date: list[0]?.date ?? null,
    label: list[0]?.date
      ? list[0]!.date!.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      : day_key,
    entries: list,
    has_backfill: list.some(e => e.backfill),
  }));
  groups.sort((a, b) => {
    if (a.date && b.date) return b.date.getTime() - a.date.getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return a.day_key < b.day_key ? 1 : -1;
  });
  return groups;
}
