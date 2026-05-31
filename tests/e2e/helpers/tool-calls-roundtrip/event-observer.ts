/**
 * Helpers for the `tool-calls-roundtrip` E2E test.
 *
 * - tailJsonl(path) — incremental JSONL reader. Returns only the NEW
 *   events since the last call, parsed.
 * - fetchThread(baseUrl, token, convId) — read agent_conversations rows
 *   for a thread via Core's HTTP API. Avoids a direct pg dependency.
 * - listThreads(baseUrl, token) — discover thread IDs for the user
 *   (used to find Sentinel's sub-thread after spawn).
 * - waitFor(predicate, timeoutMs, intervalMs) — generic polling.
 *
 * All helpers are dependency-free (Node built-ins + fetch).
 */

import { open, stat, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// ─── JSONL tailing ─────────────────────────────────────────────────

export interface JsonlEvent {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: {
    role?: 'user' | 'assistant' | 'toolResult' | 'system';
    content?: unknown;
    toolCallId?: string;
    toolName?: string;
  };
  [k: string]: unknown;
}

export interface JsonlTail {
  path: string;
  offset: number;
  /** Bytes left over from the previous read (a partial line). */
  carry: string;
}

export function newTail(path: string, fromZero = false): JsonlTail {
  return { path, offset: fromZero ? 0 : -1, carry: '' };
}

/**
 * Read the new bytes since the last call. On the very first call
 * (offset === -1) we seek to the current EOF — we want only events
 * produced during the test, not historical ones.
 */
export async function readNewEvents(t: JsonlTail): Promise<JsonlEvent[]> {
  let fh;
  try {
    fh = await open(t.path, 'r');
    const st = await fh.stat();
    if (t.offset < 0) {
      // First call → seek to EOF so subsequent calls only see new events.
      t.offset = st.size;
      return [];
    }
    if (st.size < t.offset) {
      // File shrunk (rotated). Reset.
      t.offset = 0;
      t.carry = '';
    }
    if (st.size === t.offset) return [];

    const length = st.size - t.offset;
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, t.offset);
    t.offset = st.size;

    const text = t.carry + buf.toString('utf-8');
    const lines = text.split('\n');
    // Last item is either a complete line ending at \n (empty string after split)
    // or a partial line we need to carry to the next read.
    t.carry = lines.pop() ?? '';
    const events: JsonlEvent[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as JsonlEvent);
      } catch {
        /* skip malformed */
      }
    }
    return events;
  } catch (err) {
    // File doesn't exist yet — that's fine for sub-agent JSONL which
    // OpenClaw creates lazily.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  } finally {
    await fh?.close().catch(() => {});
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// ─── HTTP API helpers ──────────────────────────────────────────────

export interface ConversationRow {
  id: string;
  conversation_id: string | null;
  session_id: string | null;
  role: string;
  type: string;
  from_agent: string;
  to_agent: string | null;
  message: string;
  tool_calls: unknown[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Envelope<T> {
  data: T;
}

export async function fetchThread(
  baseUrl: string,
  token: string,
  convId: string,
): Promise<ConversationRow[]> {
  const res = await fetch(`${baseUrl}/api/v1/conversations/threads/${convId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      // Disable keep-alive + HTTP caching to get a fresh response.
      Connection: 'close',
      'Cache-Control': 'no-cache, no-store',
    },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchThread ${convId} failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as Envelope<ConversationRow[]>;
  return Array.isArray(json.data) ? json.data : [];
}

export interface ThreadSummary {
  conversation_id: string;
  agent?: string;
  last_message_at?: string;
  message_count?: number;
  [k: string]: unknown;
}

export async function listThreads(
  baseUrl: string,
  token: string,
): Promise<ThreadSummary[]> {
  const url = `${baseUrl}/api/v1/conversations/threads?limit=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.error(`[listThreads] ${url} → ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`listThreads failed: ${res.status} ${body.slice(0, 100)}`);
  }
  const json = (await res.json()) as Envelope<ThreadSummary[]>;
  return Array.isArray(json.data) ? json.data : [];
}

// ─── Filesystem helpers ─────────────────────────────────────────────

const OPENCLAW_BASE = process.env.OPENCLAW_HOME ?? join(homedir(), '.openclaw');

/** Find newest regular .jsonl (not .trajectory.jsonl) newer than `since`. */
export async function findNewestJsonl(perUserAgentId: string, since: number): Promise<string | null> {
  const dir = join(OPENCLAW_BASE, 'agents', perUserAgentId, 'sessions');
  if (!(await fileExists(dir))) return null;
  let files: string[];
  try { files = await readdir(dir); } catch { return null; }
  let best: { path: string; mtime: number } | null = null;
  for (const f of files) {
    if (!f.endsWith('.jsonl') || f.endsWith('.trajectory.jsonl')) continue;
    const p = join(dir, f);
    try {
      const s = await stat(p);
      if (s.mtimeMs < since) continue;
      if (!best || s.mtimeMs > best.mtime) best = { path: p, mtime: s.mtimeMs };
    } catch { /* ignore */ }
  }
  return best?.path ?? null;
}

/**
 * Get the JSONL file for a specific Francis session from sessions.json.
 */
export async function getFrancisJsonlFromSessions(
  francisAgentId: string,
  sessionKey: string,
): Promise<string | null> {
  const sessionsPath = join(OPENCLAW_BASE, 'agents', francisAgentId, 'sessions', 'sessions.json');
  try {
    const raw = await readFile(sessionsPath, 'utf-8');
    const sessions = JSON.parse(raw) as Record<string, { sessionFile?: string }>;
    return sessions[sessionKey]?.sessionFile ?? null;
  } catch { return null; }
}

/**
 * Read Sentinel's sessions.json to find the session spawned by Francis.
 * Extracts conv_id from the matching session key.
 */
export async function findSentinelConvFromSessions(
  sentinelAgentId: string,
  francisSessionKeyPrefix: string,
): Promise<string | null> {
  const sessionsPath = join(OPENCLAW_BASE, 'agents', sentinelAgentId, 'sessions', 'sessions.json');
  try {
    const raw = await readFile(sessionsPath, 'utf-8');
    const sessions = JSON.parse(raw) as Record<string, { spawnedBy?: string }>;
    for (const [key, entry] of Object.entries(sessions)) {
      if (entry.spawnedBy && entry.spawnedBy.startsWith(francisSessionKeyPrefix)) {
        const m = key.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
        if (m) return m[0];
      }
    }
    return null;
  } catch { return null; }
}

// ─── Generic polling ───────────────────────────────────────────────

export async function waitFor<T>(
  predicate: () => Promise<T | null | undefined>,
  opts: { timeoutMs: number; intervalMs?: number } = { timeoutMs: 30_000 },
): Promise<T | null> {
  const intervalMs = opts.intervalMs ?? 250;
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const r = await predicate();
    if (r) return r;
    await new Promise<void>((res) => setTimeout(res, intervalMs));
  }
  return null;
}
