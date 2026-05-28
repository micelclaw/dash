/**
 * Sintetiza una vista "tipo OpenClaw" de un JSONL de sesión, en markdown.
 * Cada turno aparece como un bloque con su rol, los toolCalls inline y
 * los toolResults asociados — replica lo que OpenClaw renderizaría en su
 * UI nativa, para comparar lado a lado con lo que muestra Micelclaw.
 */

import { readFile } from 'fs/promises';

interface JsonlMsg {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: {
    role?: 'user' | 'assistant' | 'toolResult' | 'system';
    content?: unknown;
    toolCallId?: string;
    toolName?: string;
  };
}

export interface OcViewBlock {
  /** Absolute timestamp from the JSONL event (ms). */
  ts: number;
  /** Δt from the test's t0 (ms). */
  deltaFromT0: number;
  role: string;
  /** Pretty-printed markdown of this turn. */
  markdown: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function blockMarkdown(ev: JsonlMsg, toolResultsByCallId: Map<string, JsonlMsg>): string {
  const msg = ev.message;
  if (!msg) return '';
  const role = msg.role ?? '?';
  const content = msg.content;
  const lines: string[] = [];

  if (role === 'user') {
    if (typeof content === 'string') {
      lines.push(`**user:**`);
      lines.push(truncate(content, 400));
    } else if (Array.isArray(content)) {
      const texts = content
        .filter((b): b is { type: string; text?: string } => !!b && typeof b === 'object' && (b as { type?: string }).type === 'text')
        .map((b) => b.text ?? '');
      lines.push(`**user:**`);
      lines.push(truncate(texts.join('\n'), 400));
    }
  } else if (role === 'assistant') {
    if (!Array.isArray(content)) return '';
    const texts: string[] = [];
    const tcalls: string[] = [];
    for (const b of content) {
      if (!b || typeof b !== 'object') continue;
      const bb = b as { type?: string; text?: string; name?: string; id?: string; arguments?: unknown };
      if (bb.type === 'text' && bb.text) texts.push(bb.text);
      if (bb.type === 'toolCall' && bb.id && bb.name) {
        const argStr = bb.arguments && typeof bb.arguments === 'object'
          ? truncate(JSON.stringify(bb.arguments), 200)
          : (typeof bb.arguments === 'string' ? truncate(bb.arguments, 200) : '{}');
        const result = toolResultsByCallId.get(bb.id);
        let resultStr = '(no result captured)';
        if (result) {
          const rc = result.message?.content;
          let rText = '';
          if (typeof rc === 'string') rText = rc;
          else if (Array.isArray(rc)) {
            rText = rc.filter((x): x is { type: string; text?: string } => !!x && typeof x === 'object' && (x as { type?: string }).type === 'text')
              .map((x) => x.text ?? '').join('');
          }
          resultStr = truncate(rText, 300);
        }
        tcalls.push(
          `- 🔧 **tool:** \`${bb.name}\` (id=${bb.id.slice(0, 14)})\n  - **input:** \`${argStr}\`\n  - **output:** \`${resultStr.replace(/\n/g, ' ⏎ ')}\``,
        );
      }
    }
    lines.push(`**assistant:**`);
    if (texts.length > 0) lines.push(truncate(texts.join('\n'), 600));
    if (tcalls.length > 0) {
      lines.push('');
      lines.push(tcalls.join('\n'));
    }
  } else {
    return '';
  }
  return lines.join('\n');
}

export async function loadOpenclawView(
  jsonlPath: string,
  t0Ms: number,
): Promise<OcViewBlock[]> {
  let raw: string;
  try {
    raw = await readFile(jsonlPath, 'utf-8');
  } catch {
    return [];
  }
  const events: JsonlMsg[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line) as JsonlMsg); } catch { /* skip */ }
  }
  // Build toolCallId → toolResult event map
  const toolResultsByCallId = new Map<string, JsonlMsg>();
  for (const ev of events) {
    if (ev.message?.role === 'toolResult' && ev.message.toolCallId) {
      toolResultsByCallId.set(ev.message.toolCallId, ev);
    }
  }
  const blocks: OcViewBlock[] = [];
  for (const ev of events) {
    if (ev.type !== 'message') continue;
    const role = ev.message?.role;
    if (role !== 'user' && role !== 'assistant') continue;
    const md = blockMarkdown(ev, toolResultsByCallId);
    if (!md) continue;
    const ts = ev.timestamp ? Date.parse(ev.timestamp) : 0;
    blocks.push({
      ts,
      deltaFromT0: ts > 0 ? ts - t0Ms : 0,
      role: role!,
      markdown: md,
    });
  }
  return blocks;
}

/** Format a block list as a markdown column. */
export function blocksToMarkdownColumn(blocks: OcViewBlock[]): string {
  return blocks.map((b) => {
    const dt = b.deltaFromT0 > 0 ? `**+${(b.deltaFromT0 / 1000).toFixed(1)}s**` : '';
    return `${dt}\n\n${b.markdown}\n`;
  }).join('\n---\n\n');
}
