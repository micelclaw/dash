/**
 * Poll a Francis JSONL file until the agent finishes its turn.
 * "Finished" = detected sessions_yield toolCall OR the file stopped
 * growing for 3 consecutive seconds (text response with no more writes).
 */

import { open } from 'fs/promises';

export type CompletionReason = 'yield' | 'text_stable' | 'timeout';

export interface WatchResult {
  reason: CompletionReason;
  elapsedMs: number;
  lastSizeBytes: number;
}

interface JsonlEvent {
  type?: string;
  message?: {
    role?: string;
    content?: Array<{ type?: string; name?: string; text?: string }>;
  };
}

function parseEvents(text: string): JsonlEvent[] {
  return text
    .split('\n')
    .map((l) => {
      try { return JSON.parse(l) as JsonlEvent; } catch { return null; }
    })
    .filter((e): e is JsonlEvent => e !== null);
}

function hasYield(events: JsonlEvent[]): boolean {
  for (const ev of events) {
    if (ev.type !== 'message') continue;
    const content = ev.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type === 'toolCall' && (b.name === 'sessions_yield' || b.name === 'sessions_spawn')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Poll `path` until sessions_yield is detected or the file is stable.
 * Returns quickly — designed to be called every 500ms in a polling loop.
 */
export async function pollCompletion(path: string): Promise<{ done: boolean; hasYield: boolean; size: number }> {
  let fh;
  try {
    fh = await open(path, 'r');
    const st = await fh.stat();
    const size = st.size;
    const readBytes = Math.min(size, 20_000); // last 20KB
    const offset = size - readBytes;
    const buf = Buffer.alloc(readBytes);
    await fh.read(buf, 0, readBytes, offset);
    const text = buf.toString('utf-8');
    const events = parseEvents(text);
    const yielded = hasYield(events);
    return { done: yielded, hasYield: yielded, size };
  } catch {
    return { done: false, hasYield: false, size: 0 };
  } finally {
    await fh?.close().catch(() => {});
  }
}

/**
 * Wait for Francis's JSONL to signal completion.
 * Polls every `intervalMs` and returns when:
 *  - sessions_yield detected, OR
 *  - file size has been stable for `stableMs`, OR
 *  - `timeoutMs` exceeded
 */
export async function waitForCompletion(
  path: string,
  opts: { timeoutMs: number; intervalMs?: number; stableMs?: number },
): Promise<WatchResult> {
  const { timeoutMs, intervalMs = 500, stableMs = 3_000 } = opts;
  const start = Date.now();
  let lastSize = -1;
  let lastSizeChangeAt = start;

  while (Date.now() - start < timeoutMs) {
    const { done, size } = await pollCompletion(path);

    if (done) {
      return { reason: 'yield', elapsedMs: Date.now() - start, lastSizeBytes: size };
    }

    if (size !== lastSize) {
      lastSize = size;
      lastSizeChangeAt = Date.now();
    } else if (lastSize > 0 && Date.now() - lastSizeChangeAt >= stableMs) {
      return { reason: 'text_stable', elapsedMs: Date.now() - start, lastSizeBytes: size };
    }

    await new Promise<void>((res) => setTimeout(res, intervalMs));
  }

  return { reason: 'timeout', elapsedMs: Date.now() - start, lastSizeBytes: lastSize };
}
