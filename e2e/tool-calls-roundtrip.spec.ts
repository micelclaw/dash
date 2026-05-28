/**
 * tool-calls-roundtrip.spec.ts
 *
 * Prueba E2E completa de delegación Francis → Sentinel.
 *
 * Produce:
 *   - dash/e2e/screenshots/tool-calls-roundtrip/NN-fase-tXs.png  (12 capturas)
 *   - dash/e2e/reports/tool-calls-roundtrip.md (reporte con 6 secciones)
 *
 * Captura granular: cada línea del JSONL de Francis y Sentinel, cada evento
 * WS recibido por el dash, cada mutación del DOM (nuevo bubble), cada row
 * que aparece en DB. La matriz de latencias permite ver el lag de cada
 * etapa del pipeline.
 *
 * Run:
 *   DATABASE_URL=postgresql://claw:claw_secret@127.0.0.1:5433/clawos \
 *   E2E_BASE_URL=http://localhost:7100 CORE_BASE_URL=http://localhost:7200 \
 *   PACO_EMAIL=paco@claw.local PACO_PASSWORD=ClawPaco1@! \
 *   PACO_USER_PREFIX=paco OPENCLAW_HOME=$HOME/.openclaw \
 *   pnpm exec playwright test tool-calls-roundtrip.spec.ts --headed
 */

import { test, type Page } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

import {
  findNewestJsonl,
  findSentinelConvFromSessions,
  getFrancisJsonlFromSessions,
  newTail,
  readNewEvents,
  type JsonlEvent,
} from './helpers/tool-calls-roundtrip/event-observer';
import { TimelineRecorder } from './helpers/tool-calls-roundtrip/timeline-recorder';
import {
  writeReport,
  type Assertion,
  type ScreenshotEntry,
  type LatencyRow,
  type DbRawRow,
} from './helpers/tool-calls-roundtrip/report-writer';
import { loadOpenclawView, type OcViewBlock } from './helpers/tool-calls-roundtrip/openclaw-view';
import {
  getThreadRows,
  findUserId,
  getNewestUserConvId,
  closeSql,
} from './helpers/tool-calls-roundtrip/db-direct';

// ─── Config ────────────────────────────────────────────────────────
const DASH_URL   = process.env.E2E_BASE_URL ?? 'http://localhost:7100';
const CORE_URL   = process.env.CORE_BASE_URL ?? 'http://localhost:7200';
const PACO_EMAIL    = process.env.PACO_EMAIL ?? 'paco@claw.local';
const PACO_PASSWORD = process.env.PACO_PASSWORD ?? 'ClawPaco1@!';
const PACO_USER_PREFIX = process.env.PACO_USER_PREFIX ?? 'paco';
const PROMPT = 'Delega a Sentinel: cuantos procesos hay activos y que cpu y ram estan consumiendo los 5 mas activos.';

const SCREENSHOTS_DIR = join(process.cwd(), 'e2e', 'screenshots', 'tool-calls-roundtrip');
const REPORT_PATH     = join(process.cwd(), 'e2e', 'reports', 'tool-calls-roundtrip.md');

const FRANCIS_AGENT  = `${PACO_USER_PREFIX}--francis`;
const SENTINEL_AGENT = `${PACO_USER_PREFIX}--sentinel`;

// ─── Helpers internos ───────────────────────────────────────────────

interface ShotCtx {
  page: Page;
  t0: number;
  shots: ScreenshotEntry[];
  recorder: TimelineRecorder;
}

/** Expand all collapsed tool pills in the current view.
 *  Cada pill es un <button> que contiene el SVG lucide-chevron-right (colapsado)
 *  o lucide-chevron-down (expandido). Clicar el button toggle expansión. */
async function expandPills(page: Page): Promise<void> {
  try {
    // Find every button that currently has a chevron-right SVG (collapsed state).
    // Lucide renders icons with class "lucide-chevron-right" or has the SVG path.
    const collapsedButtons = page.locator('button:has(svg.lucide-chevron-right), button:has(svg[class*="chevron-right"])');
    const count = await collapsedButtons.count();
    for (let i = 0; i < Math.min(count, 20); i++) {
      const b = collapsedButtons.nth(i);
      await b.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => {});
      await b.click({ timeout: 1_000, force: true }).catch(() => {});
    }
    await page.waitForTimeout(500);
  } catch { /* ignore */ }
}

/** Marker (formerly screenshot — kept as a no-op to keep call sites valid).
 *  User explicitly disabled screenshot capture; we still record the milestone
 *  in the timeline so the report's event chain stays granular. */
async function shoot(ctx: ShotCtx, index: string, caption: string): Promise<void> {
  ctx.recorder.record('screenshot', `[${index}] ${caption}`, { screenshot: index });
  // No file is written. The page reference is kept available in ctx for future use.
  void ctx.page;
}

// ─── TEST ──────────────────────────────────────────────────────────
test('tool-calls roundtrip: Francis → Sentinel @live', async ({ page }) => {
  test.setTimeout(360_000); // 6 min — LLM puede ser lento

  const recorder = new TimelineRecorder();
  const assertions: Assertion[] = [];
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  // ── 1. Pre-flight ─────────────────────────────────────────────────
  const coreOk = await fetch(`${CORE_URL}/health`).then(r => r.ok).catch(() => false);
  recorder.record('system', `Core /health=${coreOk ? 'ok' : 'DOWN'}`);
  assertions.push({ description: 'Core /health responde', passed: coreOk });

  // ── 2. Login + inject localStorage ────────────────────────────────
  const loginRes = await fetch(`${CORE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PACO_EMAIL, password: PACO_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const loginData = (await loginRes.json()) as {
    data: { access_token: string; user: { id: string; email: string; role: string } };
  };
  const apiToken = loginData.data.access_token;
  const pacoUser = loginData.data.user;
  recorder.record('user', `logged in as ${pacoUser.email}`);

  const pacoUserId = (await findUserId(PACO_EMAIL)) ?? `${PACO_USER_PREFIX}-8bfb-44c8-b858-0d56364fe728`;

  await page.addInitScript((payload) => {
    try {
      localStorage.setItem('claw-auth', payload);
      sessionStorage.removeItem('claw-explicit-logout');
    } catch { /* ignore */ }
  }, JSON.stringify({
    state: {
      tokens: { accessToken: apiToken, refreshToken: '' },
      user: { id: pacoUser.id, email: pacoUser.email, display_name: pacoUser.email, role: pacoUser.role },
      isAuthenticated: true,
      pending2fa: null,
    },
    version: 0,
  }));

  // ── 3. Hook WS + DOM observer ANTES de navegar ───────────────────
  // Cada vez que la página recibe un mensaje WebSocket o aparece un
  // bubble nuevo, lo reenviamos al test para registrarlo en el timeline.
  await page.exposeFunction('clawRecordWs', (info: { event: string; t: number; convId?: string }) => {
    recorder.record('WS:dash', `${info.event}${info.convId ? ` conv=${info.convId.slice(0, 8)}` : ''}`, { ws_event: info.event, conv: info.convId });
  });
  await page.exposeFunction('clawRecordDom', (info: { kind: string; preview: string; t: number }) => {
    recorder.record('DOM', `${info.kind}: ${info.preview}`, { dom_kind: info.kind });
  });

  await page.addInitScript(() => {
    // Hook WebSocket constructor to intercept messages
    const OrigWS = window.WebSocket;
    const intercept = function (this: WebSocket, ...args: unknown[]) {
      // @ts-expect-error spread on constructor
      const ws = new OrigWS(...args);
      ws.addEventListener('message', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string);
          if (data && typeof data === 'object' && data.event) {
            const conv = data.data?.conversation_id ?? data.data?.conversationId ?? undefined;
            // @ts-expect-error exposed
            window.clawRecordWs?.({ event: data.event, t: Date.now(), convId: conv });
          }
        } catch { /* skip non-JSON */ }
      });
      return ws;
    };
    // @ts-expect-error replace constructor
    window.WebSocket = intercept;
    Object.setPrototypeOf(intercept, OrigWS);
    intercept.prototype = OrigWS.prototype;

    // MutationObserver for new chat bubbles
    const observe = () => {
      const root = document.body;
      if (!root) {
        setTimeout(observe, 200);
        return;
      }
      const seen = new WeakSet<Element>();
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            if (seen.has(n)) return;
            const cls = (n.className || '').toString();
            const txt = (n.textContent || '').trim();
            if (!txt) return;
            // Look for things that look like chat bubbles / tool pills
            if (/message|bubble|tool|pill|chat/i.test(cls) && txt.length > 4 && txt.length < 200) {
              seen.add(n);
              // @ts-expect-error exposed
              window.clawRecordDom?.({ kind: 'new_element', preview: txt.slice(0, 80), t: Date.now() });
            }
          });
        }
      });
      mo.observe(root, { childList: true, subtree: true });
    };
    observe();
  });

  // ── 4. Navigate + select Francis ──────────────────────────────────
  await page.goto(`${DASH_URL}/chat`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  recorder.record('dash', `chat page loaded`);

  const t0Login = Date.now();
  void t0Login;

  // Marker 00 (no-op): dash cargado tras login. Screenshots disabled by user.
  const earlyShots: ScreenshotEntry[] = [];
  recorder.record('screenshot', '[00] Dash cargado tras login');

  // Select Francis via dropdown
  try {
    const agentTrigger = page.locator('button').filter({ hasText: '▾' }).first();
    await agentTrigger.waitFor({ state: 'visible', timeout: 5_000 });
    const currentText = await agentTrigger.innerText().catch(() => '');
    if (!/francis/i.test(currentText)) {
      await agentTrigger.click();
      // Wait for the menu to render then click Francis. Use getByRole for a
      // more accessible-name match; fallback to text locator.
      const francisItem = page.getByRole('menuitem', { name: /^francis/i }).first();
      try {
        await francisItem.waitFor({ state: 'visible', timeout: 4_000 });
        await francisItem.click({ timeout: 3_000 });
      } catch {
        // Fallback locator
        await page.locator('[role="menuitem"]').filter({ hasText: /francis/i }).first().click({ timeout: 3_000 }).catch(() => {});
      }
      await page.waitForTimeout(500);
      recorder.record('user', 'agent set to Francis via dropdown');
    } else {
      recorder.record('user', 'Francis already selected');
    }
  } catch {
    recorder.record('system', 'WARN: agent selector not found');
  }
  // Defensive: ensure no dropdown is left open occluding the sidebar.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);

  // New chat
  const newChatBtn = page.getByRole('button', { name: 'New chat', exact: true });
  await newChatBtn.first().scrollIntoViewIfNeeded({ timeout: 10_000 });
  await newChatBtn.first().click({ timeout: 10_000 });
  await page.waitForTimeout(400);

  // Fill + send
  const textarea = page.getByPlaceholder('Ask anything...');
  await textarea.first().waitFor({ state: 'visible', timeout: 8_000 });
  await textarea.first().click();
  await textarea.first().fill(PROMPT);

  const t0 = Date.now();
  recorder.record('user', 'submit prompt (t0)');
  await textarea.first().press('Enter');

  const ctx: ShotCtx = { page, t0, shots: [...earlyShots], recorder };

  // ── 5. Descubrir francisConvId desde DB ──────────────────────────
  const francisConvId = await (async () => {
    const sinceEpochSec = Math.floor(t0 / 1000);
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const id = await getNewestUserConvId(pacoUserId, sinceEpochSec).catch(() => null);
      if (id) return id;
      await new Promise<void>(res => setTimeout(res, 600));
    }
    return null;
  })();
  if (!francisConvId) throw new Error('Francis conv_id not found in DB within 15s');
  recorder.record('system', `francisConvId=${francisConvId.slice(0, 8)}…`);

  await shoot(ctx, '01', 'Prompt enviado — bubble usuario visible');

  // ── 6. Tail concurrente: Francis JSONL + DB poll + Sentinel discover ─
  //    Lanzamos las tareas en background con AbortController-like flags.
  const francisSessionKey = `agent:${FRANCIS_AGENT}:webchat:${francisConvId}`;

  let stopFrancisTail = false;
  let francisJsonl: string | null = null;
  const francisEventsRecorded = new Set<string>();

  const francisTailPromise = (async () => {
    // Wait for JSONL to exist
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !francisJsonl && !stopFrancisTail) {
      francisJsonl = await getFrancisJsonlFromSessions(FRANCIS_AGENT, francisSessionKey).catch(() => null)
        ?? await findNewestJsonl(FRANCIS_AGENT, t0 - 2_000).catch(() => null);
      if (!francisJsonl) await new Promise<void>(res => setTimeout(res, 400));
    }
    if (!francisJsonl) return;
    recorder.record('JSONL', `francis JSONL: ${francisJsonl.split('/').pop()}`);
    const tail = newTail(francisJsonl, true);
    while (!stopFrancisTail) {
      const evs = await readNewEvents(tail).catch(() => [] as JsonlEvent[]);
      for (const ev of evs) {
        const evId = ev.id ?? '';
        if (evId && francisEventsRecorded.has(evId)) continue;
        if (evId) francisEventsRecorded.add(evId);
        if (ev.type !== 'message') continue;
        const role = ev.message?.role;
        const c = ev.message?.content;
        const lag = Date.now() - t0;
        if (role === 'user') {
          recorder.record('OC:Francis', `user message`);
        } else if (role === 'assistant' && Array.isArray(c)) {
          for (const b of c as Array<{ type?: string; name?: string; id?: string; text?: string }>) {
            if (b.type === 'toolCall' && b.name && b.id) {
              recorder.record('OC:Francis', `assistant toolCall=${b.name}`, { tool_id: b.id, tool: b.name });
            }
            if (b.type === 'text' && b.text && b.text.trim().length > 0) {
              recorder.record('OC:Francis', `assistant text: "${b.text.slice(0, 60).replace(/\n/g, ' ')}"`, { lag });
            }
          }
        } else if (role === 'toolResult' && ev.message?.toolCallId) {
          const out = typeof c === 'string' ? c : (Array.isArray(c) ? (c as Array<{ text?: string }>).map((x) => x.text ?? '').join('') : '');
          recorder.record('OC:Francis', `toolResult for ${ev.message.toolCallId.slice(0, 14)}: "${out.slice(0, 50).replace(/\n/g, ' ')}"`, { tool_id: ev.message.toolCallId });
        }
      }
      await new Promise<void>(res => setTimeout(res, 400));
    }
  })();

  let stopSentinelTail = false;
  let sentinelConvId: string | null = null;
  let sentinelJsonl: string | null = null;
  const sentinelEventsRecorded = new Set<string>();
  let sentinelFirstToolDelta: number | null = null;
  let sentinelFinalTextDelta: number | null = null;

  const sentinelTailPromise = (async () => {
    // Wait for Sentinel to be spawned (conv discoverable)
    const discoveryDeadline = Date.now() + 90_000;
    while (Date.now() < discoveryDeadline && !sentinelConvId && !stopSentinelTail) {
      sentinelConvId = await findSentinelConvFromSessions(SENTINEL_AGENT, francisSessionKey.slice(0, 60)).catch(() => null);
      if (!sentinelConvId) await new Promise<void>(res => setTimeout(res, 500));
    }
    if (!sentinelConvId) return;
    recorder.record('system', `sentinel conv discovered lag=${Date.now() - t0}ms`, { conv_id: sentinelConvId });
    // Find Sentinel's JSONL (created lazily by OpenClaw)
    const jsonlDeadline = Date.now() + 15_000;
    while (Date.now() < jsonlDeadline && !sentinelJsonl && !stopSentinelTail) {
      sentinelJsonl = await findNewestJsonl(SENTINEL_AGENT, t0 - 5_000).catch(() => null);
      if (!sentinelJsonl) await new Promise<void>(res => setTimeout(res, 500));
    }
    if (!sentinelJsonl) return;
    recorder.record('JSONL', `sentinel JSONL: ${sentinelJsonl.split('/').pop()}`);
    const tail = newTail(sentinelJsonl, true);
    while (!stopSentinelTail) {
      const evs = await readNewEvents(tail).catch(() => [] as JsonlEvent[]);
      for (const ev of evs) {
        const evId = ev.id ?? '';
        if (evId && sentinelEventsRecorded.has(evId)) continue;
        if (evId) sentinelEventsRecorded.add(evId);
        if (ev.type !== 'message') continue;
        const role = ev.message?.role;
        const c = ev.message?.content;
        const lag = Date.now() - t0;
        if (role === 'user') {
          recorder.record('OC:Sentinel', `user (briefing)`);
        } else if (role === 'assistant' && Array.isArray(c)) {
          for (const b of c as Array<{ type?: string; name?: string; id?: string; text?: string }>) {
            if (b.type === 'toolCall' && b.name && b.id) {
              recorder.record('OC:Sentinel', `assistant toolCall=${b.name}`, { tool_id: b.id, tool: b.name });
              if (sentinelFirstToolDelta === null) sentinelFirstToolDelta = lag;
            }
            if (b.type === 'text' && b.text && b.text.trim().length > 0) {
              recorder.record('OC:Sentinel', `assistant text final: "${b.text.slice(0, 70).replace(/\n/g, ' ')}"`, { lag });
              if (sentinelFinalTextDelta === null) sentinelFinalTextDelta = lag;
            }
          }
        } else if (role === 'toolResult' && ev.message?.toolCallId) {
          const out = typeof c === 'string' ? c : (Array.isArray(c) ? (c as Array<{ text?: string }>).map((x) => x.text ?? '').join('') : '');
          recorder.record('OC:Sentinel', `toolResult for ${ev.message.toolCallId.slice(0, 14)}: "${out.slice(0, 50).replace(/\n/g, ' ')}"`, { tool_id: ev.message.toolCallId });
        }
      }
      await new Promise<void>(res => setTimeout(res, 400));
    }
  })();

  // ── 7. Esperar a que aparezca la primera fila assistant de Francis en DB ─
  const francisAssistantWaitDeadline = Date.now() + 90_000;
  let francisFirstAssistantDelta: number | null = null;
  while (Date.now() < francisAssistantWaitDeadline && francisFirstAssistantDelta === null) {
    const rows = await getThreadRows(francisConvId, pacoUserId).catch(() => []);
    const row = rows.find((r) => r.role === 'assistant');
    if (row) {
      francisFirstAssistantDelta = Date.now() - t0;
      const n = Array.isArray(row.tool_calls) ? row.tool_calls.length : 0;
      recorder.record('DB', `francis assistant row inserted (n_tools=${n})`, { n_tools: n });
      break;
    }
    await new Promise<void>(res => setTimeout(res, 700));
  }

  // ── 8. Screenshot 02 + 03: Francis con pills colapsadas y expandidas ─
  await page.waitForTimeout(1_500); // dejar al DOM tiempo a renderizar
  await shoot(ctx, '02', 'Francis con tool pills (colapsadas)');
  await expandPills(page);
  await shoot(ctx, '03', 'Francis con tool pills (expandidas — input y output visibles)');

  // ── 9. Esperar Sentinel en sidebar + screenshot 04 ───────────────
  let sentinelSidebarDelta: number | null = null;
  try {
    const sentinelEntry = page.locator('text=/Sentinel/i').first();
    await sentinelEntry.waitFor({ state: 'visible', timeout: 30_000 });
    sentinelSidebarDelta = Date.now() - t0;
    recorder.record('dash', `Sentinel thread visible en sidebar`, { lag: sentinelSidebarDelta });
  } catch {
    recorder.record('dash', 'WARN: Sentinel entry not found in sidebar');
  }
  await shoot(ctx, '04', 'Sidebar muestra el thread de Sentinel');

  // ── 10. Navegar a Sentinel, esperar render, screenshots 05+06 ────
  try {
    const sentinelBtn = page.locator('button').filter({ hasText: /^Sentinel/i }).first();
    await sentinelBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await sentinelBtn.click();
    await page.waitForTimeout(2_000);
    recorder.record('dash', `navegado a Sentinel chat`);
    await shoot(ctx, '05', 'Chat de Sentinel — briefing + actividad');

    // Esperar a que Sentinel termine (su JSONL recibe su text final)
    const sentinelFinishDeadline = Date.now() + 90_000;
    while (Date.now() < sentinelFinishDeadline && sentinelFinalTextDelta === null) {
      await new Promise<void>(res => setTimeout(res, 1_000));
    }
    if (sentinelFinalTextDelta !== null) {
      recorder.record('system', `Sentinel completó (en JSONL) a +${sentinelFinalTextDelta}ms`);
    }
    // Esperar al mirror para que persista los tool_calls (smart-trigger ~30s)
    await page.waitForTimeout(5_000);
    await expandPills(page);
    await shoot(ctx, '06', 'Chat de Sentinel con exec pills expandidos + respuesta final');

    // Volver a Francis — específicamente a la conv DE NUESTRO TEST (por título matching "Delega a Sentinel")
    // El locator anterior `.first()` pillaba cualquier conv vieja con "Francis".
    const francisOurConv = page.locator('button, [role="button"]').filter({ hasText: /Delega a Sentinel/i }).first();
    try {
      await francisOurConv.waitFor({ state: 'visible', timeout: 5_000 });
      await francisOurConv.click();
    } catch {
      // Fallback: click cualquier Francis
      await page.locator('button').filter({ hasText: /^Francis/i }).first().click().catch(() => {});
    }
    await page.waitForTimeout(1_500);
    recorder.record('dash', 'navegado de vuelta a Francis conv');
  } catch {
    recorder.record('dash', 'WARN: fallo navegando a Sentinel');
    await shoot(ctx, '05', 'Navegación a Sentinel falló');
    await shoot(ctx, '06', 'Sentinel no se pudo navegar');
  }

  // ── 11. Esperar post-yield de Francis ────────────────────────────
  let postYieldDelta: number | null = null;
  const postYieldDeadline = Date.now() + 180_000;
  while (Date.now() < postYieldDeadline && postYieldDelta === null) {
    const rows = await getThreadRows(francisConvId, pacoUserId).catch(() => []);
    const assistantRows = rows.filter((r) => r.role === 'assistant');
    if (assistantRows.length >= 2) {
      postYieldDelta = Date.now() - t0;
      const py = assistantRows[assistantRows.length - 1];
      recorder.record('DB', `post-yield Francis en DB`, { lag: postYieldDelta, preview: py.message.slice(0, 60) });
      break;
    }
    await new Promise<void>(res => setTimeout(res, 1_500));
  }

  // Esperar a que el WS event llegue al DOM
  await page.waitForTimeout(3_000);

  // Scroll al fondo + screenshot 07
  try {
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[class*="overflow"], [class*="scroll"], main, [class*="message"]')) as HTMLElement[];
      for (const el of candidates) {
        if (el.scrollHeight > el.clientHeight) {
          el.scrollTop = el.scrollHeight;
        }
      }
    });
    await page.waitForTimeout(500);
    await expandPills(page);
  } catch { /* ignore */ }
  await shoot(ctx, '07', 'Francis post-yield — respuesta final con datos de Sentinel');

  // ── 12. Screenshot 08: vista completa con scroll al inicio ──────
  try {
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[class*="overflow"], [class*="scroll"], main')) as HTMLElement[];
      for (const el of candidates) {
        if (el.scrollHeight > el.clientHeight) {
          el.scrollTop = 0;
        }
      }
    });
    await page.waitForTimeout(400);
  } catch { /* ignore */ }
  await shoot(ctx, '08', 'Conversación Francis completa — scroll al inicio');

  // Final state: scroll bottom otra vez
  try {
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[class*="overflow"], [class*="scroll"], main')) as HTMLElement[];
      for (const el of candidates) {
        if (el.scrollHeight > el.clientHeight) {
          el.scrollTop = el.scrollHeight;
        }
      }
    });
    await page.waitForTimeout(300);
  } catch { /* ignore */ }
  await shoot(ctx, '09', 'Estado final — fondo del chat de Francis');

  // ── 13. Detener tails ────────────────────────────────────────────
  stopFrancisTail = true;
  stopSentinelTail = true;
  await Promise.race([
    Promise.allSettled([francisTailPromise, sentinelTailPromise]),
    new Promise<void>(res => setTimeout(res, 3_000)),
  ]);

  // ── 14. Capturar DB final ────────────────────────────────────────
  const francisFinal = await getThreadRows(francisConvId, pacoUserId).catch(() => []);
  const sentinelFinal = sentinelConvId ? await getThreadRows(sentinelConvId, pacoUserId).catch(() => []) : [];

  recorder.record('DB', `final francis rows=${francisFinal.length} sentinel rows=${sentinelFinal.length}`);

  // ── 15. Construir vista OpenClaw sintetizada ─────────────────────
  let ocFrancisBlocks: OcViewBlock[] = [];
  let ocSentinelBlocks: OcViewBlock[] = [];
  if (francisJsonl) ocFrancisBlocks = await loadOpenclawView(francisJsonl, t0);
  if (sentinelJsonl) ocSentinelBlocks = await loadOpenclawView(sentinelJsonl, t0);

  // ── 16. Construir matriz de latencias ────────────────────────────
  const findOcDelta = (source: 'OC:Francis' | 'OC:Sentinel', tool: string): number | null => {
    const ev = recorder.all().find((e) => e.source === source && (e.meta?.tool === tool || e.description.includes(`toolCall=${tool}`)));
    return ev ? ev.delta : null;
  };
  // Find the LAST text event from a source — Francis's post-yield is the last text event for Francis after his yield.
  const findOcLastTextDelta = (source: 'OC:Francis' | 'OC:Sentinel', afterDelta = 0): number | null => {
    let last: number | null = null;
    for (const e of recorder.all()) {
      if (e.source !== source) continue;
      if (!/assistant text/i.test(e.description)) continue;
      if (e.delta < afterDelta) continue;
      last = e.delta;
    }
    return last;
  };
  const francisYieldDelta = findOcDelta('OC:Francis', 'sessions_yield');
  const francisPostYieldOcDelta = francisYieldDelta !== null
    ? findOcLastTextDelta('OC:Francis', francisYieldDelta + 1_000)
    : findOcLastTextDelta('OC:Francis');
  const wsFrancisDone = recorder.all().find((e) => e.source === 'WS:dash' && e.description.startsWith('chat.stream.done'));
  const wsSentinelSubagent = recorder.all().find((e) => e.source === 'WS:dash' && e.description.startsWith('chat.subagent_message'));
  const wsPostYield = recorder.all().find((e) => e.source === 'WS:dash' && e.description.startsWith('chat.post_yield_message'));
  const wsSentinelExec = (() => {
    const t = sentinelFirstToolDelta;
    if (t === null) return null;
    const ev = recorder.all().find((e) => e.source === 'WS:dash' && e.description.startsWith('chat.subagent_message') && e.delta >= t);
    return ev ? ev.delta : null;
  })();
  const domNewBubbleAfterFrancisResp = recorder.all().find((e) => e.source === 'DOM' && (francisFirstAssistantDelta !== null) && e.delta >= francisFirstAssistantDelta);
  const domNewBubbleAfterPostYield = postYieldDelta !== null
    ? recorder.all().find((e) => e.source === 'DOM' && e.delta >= postYieldDelta) ?? null
    : null;

  const latencyMatrix: LatencyRow[] = [
    {
      event: 'Francis · primer toolCall (sessions_spawn)',
      ocJsonl: findOcDelta('OC:Francis', 'sessions_spawn'),
      mirror: null,
      db: francisFirstAssistantDelta,
      ws: wsFrancisDone ? wsFrancisDone.delta : null,
      dom: domNewBubbleAfterFrancisResp ? domNewBubbleAfterFrancisResp.delta : null,
    },
    {
      event: 'Sentinel · briefing recibido',
      ocJsonl: recorder.all().find((e) => e.source === 'OC:Sentinel' && e.description.includes('user (briefing)'))?.delta ?? null,
      mirror: null,
      db: null,
      ws: wsSentinelSubagent ? wsSentinelSubagent.delta : null,
      dom: sentinelSidebarDelta,
    },
    {
      event: 'Sentinel · primer exec',
      ocJsonl: sentinelFirstToolDelta,
      mirror: null,
      db: null,
      ws: wsSentinelExec,
      dom: null,
    },
    {
      event: 'Sentinel · respuesta final',
      ocJsonl: sentinelFinalTextDelta,
      mirror: null,
      db: null,
      ws: null,
      dom: null,
    },
    {
      event: 'Francis · post-yield (texto final)',
      ocJsonl: francisPostYieldOcDelta,
      mirror: null,
      db: postYieldDelta,
      ws: wsPostYield ? wsPostYield.delta : null,
      dom: domNewBubbleAfterPostYield ? domNewBubbleAfterPostYield.delta : null,
    },
  ];

  // ── 17. Assertions ──────────────────────────────────────────────
  const francisAssistants = francisFinal.filter((r) => r.role === 'assistant');
  assertions.push({
    description: 'Francis tiene ≥1 fila assistant',
    passed: francisAssistants.length >= 1,
    detail: `got ${francisAssistants.length}`,
  });
  const francisWithTools = francisAssistants.find(
    (r) => Array.isArray(r.tool_calls) && r.tool_calls.length > 0,
  );
  assertions.push({
    description: 'Francis assistant tiene tool_calls persistidos',
    passed: !!francisWithTools,
    detail: francisWithTools ? `n_tools=${francisWithTools.tool_calls!.length}` : 'sin tool_calls',
  });
  const hasDelegation = francisFinal.some((r) =>
    Array.isArray(r.tool_calls) &&
    r.tool_calls.some((tc: unknown) => {
      const t = (tc as { tool?: string }).tool;
      return t === 'sessions_spawn' || t === 'sessions_yield';
    }),
  );
  assertions.push({
    description: 'Francis tiene sessions_spawn o sessions_yield (delegación probada)',
    passed: hasDelegation,
  });
  const sIdForAssertion = sentinelConvId as string | null;
  assertions.push({
    description: 'Sentinel conv descubierto via sessions.json',
    passed: !!sIdForAssertion,
    detail: sIdForAssertion ? `id=${(sIdForAssertion as string).slice(0, 8)}…` : 'no encontrado',
  });
  if (sentinelConvId) {
    const briefing = sentinelFinal.find(
      (r) => r.role === 'user' && (r.metadata as { briefing?: boolean })?.briefing === true,
    );
    assertions.push({
      description: 'Sentinel tiene briefing (metadata.briefing=true)',
      passed: !!briefing,
      detail: briefing ? `task="${briefing.message.slice(0, 60)}…"` : 'sin briefing',
    });
    const sentinelAssistantRows = sentinelFinal.filter((r) => r.role === 'assistant');
    assertions.push({
      description: 'Sentinel tiene ≥1 fila assistant',
      passed: sentinelAssistantRows.length >= 1,
      detail: `rows=${sentinelAssistantRows.length}`,
    });
    const sentinelWithTools = sentinelAssistantRows.find(
      (r) => Array.isArray(r.tool_calls) && r.tool_calls.length > 0,
    );
    assertions.push({
      description: 'Sentinel assistant tiene tool_calls persistidos',
      passed: !!sentinelWithTools,
      detail: sentinelWithTools ? `n_tools=${sentinelWithTools.tool_calls!.length}` : 'sin tool_calls',
    });
  }
  assertions.push({
    description: 'Sentinel visible en sidebar del dash',
    passed: sentinelSidebarDelta !== null,
    detail: sentinelSidebarDelta ? `lag=${sentinelSidebarDelta}ms` : 'nunca visto',
  });
  assertions.push({
    description: 'Post-yield de Francis aparece (respuesta final)',
    passed: postYieldDelta !== null,
    detail: postYieldDelta !== null ? `lag=${postYieldDelta}ms` : 'no apareció dentro del timeout',
    warning: true,
  });

  // ── 18. DB raw dump ─────────────────────────────────────────────
  const dbRawRows: DbRawRow[] = [
    ...francisFinal,
    ...sentinelFinal,
  ].map((r) => ({
    conversation_id: r.conversation_id,
    role: r.role,
    from_agent: r.from_agent,
    n_tools: Array.isArray(r.tool_calls) ? r.tool_calls.length : 0,
    message_preview: r.message,
    created_at: r.created_at,
  })).sort((a, b) => a.created_at.localeCompare(b.created_at));

  await closeSql();

  // ── 19. Headline metrics ────────────────────────────────────────
  const headlineMetrics = [
    {
      label: 'Francis tool_calls en DB',
      value: francisWithTools ? `${francisWithTools.tool_calls!.length} (${(francisWithTools.tool_calls as Array<{tool?: string}>).map(t => t.tool).join(', ')})` : '0',
      verdict: francisWithTools ? '✅' as const : '❌' as const,
    },
    {
      label: 'Sentinel tool_calls en DB',
      value: (() => {
        const s = sentinelFinal.find((r) => r.role === 'assistant' && Array.isArray(r.tool_calls) && r.tool_calls.length > 0);
        return s ? `${s.tool_calls!.length} (status=${(s.tool_calls as Array<{status?: string}>).map(t => t.status).join(',')})` : '0';
      })(),
      verdict: sentinelFinal.some((r) => r.role === 'assistant' && Array.isArray(r.tool_calls) && r.tool_calls.length > 0)
        ? '✅' as const : '❌' as const,
    },
    {
      label: 'Sentinel thread en sidebar (lag)',
      value: sentinelSidebarDelta !== null ? `${Math.round(sentinelSidebarDelta / 1000)}s` : '—',
      verdict: sentinelSidebarDelta !== null && sentinelSidebarDelta < 60_000 ? '✅' as const : (sentinelSidebarDelta !== null ? '⚠️' as const : '❌' as const),
    },
    {
      label: 'Francis primera respuesta (lag)',
      value: francisFirstAssistantDelta !== null ? `${Math.round(francisFirstAssistantDelta / 1000)}s` : '—',
      verdict: francisFirstAssistantDelta !== null ? '✅' as const : '❌' as const,
    },
    {
      label: 'Post-yield Francis en DB (lag)',
      value: postYieldDelta !== null ? `${Math.round(postYieldDelta / 1000)}s` : '—',
      verdict: postYieldDelta !== null ? '✅' as const : '⚠️' as const,
    },
  ];

  // ── 20. Escribir el reporte ─────────────────────────────────────
  await writeReport({
    reportPath: REPORT_PATH,
    screenshotsDir: SCREENSHOTS_DIR,
    screenshotsRelative: '../screenshots/tool-calls-roundtrip',
    prompt: PROMPT,
    recorder,
    assertions,
    submitT0: t0,
    screenshots: ctx.shots,
    latencyMatrix,
    headlineMetrics,
    ocFrancisBlocks,
    ocSentinelBlocks,
    dbRows: dbRawRows,
    notes: [
      `Francis conv: \`${francisConvId}\``,
      `Sentinel conv: \`${sentinelConvId ?? '(no encontrado)'}\``,
      `Francis JSONL: \`${francisJsonl ?? '(no encontrado)'}\``,
      `Sentinel JSONL: \`${sentinelJsonl ?? '(no encontrado)'}\``,
    ].join('\n\n'),
  });

  // ── 21. Fail only on critical assertions ────────────────────────
  const failed = assertions.filter((a) => !a.passed && !a.warning);
  if (failed.length > 0) {
    throw new Error(
      `${failed.length}/${assertions.length} assertions fallaron → ${REPORT_PATH}\n` +
      failed.map((f) => ` - ${f.description}${f.detail ? ` (${f.detail})` : ''}`).join('\n'),
    );
  }
});
