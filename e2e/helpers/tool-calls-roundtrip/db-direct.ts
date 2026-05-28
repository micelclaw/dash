/**
 * Direct DB queries via psql subprocess.
 * Avoids any npm package dependency — psql is always available on the system.
 * Bypasses the Core HTTP API (which has a ~5min lag on new rows).
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://claw:claw_secret@127.0.0.1:5433/clawos';

async function psqlQuery(sql: string): Promise<string> {
  // Collapse to single line — psql -c rejects embedded newlines
  const oneLiner = sql.replace(/\s+/g, ' ').trim();
  const { stdout } = await execAsync(
    `psql "${DB_URL}" -t -A -c ${JSON.stringify(oneLiner)}`,
    { env: { ...process.env, PGPASSWORD: 'claw_secret' } },
  );
  return stdout.trim();
}

export interface DbRow {
  id: string;
  conversation_id: string;
  role: string;
  from_agent: string;
  message: string;
  tool_calls: unknown[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Return all rows for a conversation, ordered by created_at ASC. */
export async function getThreadRows(convId: string, userId: string): Promise<DbRow[]> {
  // Use JSON output to safely handle messages with newlines.
  const sql = `SELECT row_to_json(t) FROM (SELECT id::text, conversation_id, role, from_agent, LEFT(message,500) AS message, tool_calls, metadata, created_at::text FROM agent_conversations WHERE conversation_id = '${convId}' AND user_id = '${userId}'::uuid ORDER BY created_at ASC) t`;
  const output = await psqlQuery(sql);
  if (!output) return [];
  const rows: DbRow[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as {
        id: string; conversation_id: string; role: string; from_agent: string;
        message: string; tool_calls: unknown | null; metadata: unknown | null; created_at: string;
      };
      rows.push({
        id: obj.id,
        conversation_id: obj.conversation_id,
        role: obj.role,
        from_agent: obj.from_agent,
        message: obj.message ?? '',
        tool_calls: Array.isArray(obj.tool_calls) ? obj.tool_calls : null,
        metadata: (obj.metadata && typeof obj.metadata === 'object') ? obj.metadata as Record<string, unknown> : {},
        created_at: obj.created_at,
      });
    } catch { /* skip malformed line */ }
  }
  return rows;
}

/** Find the user_id by email. */
export async function findUserId(email: string): Promise<string | null> {
  const sql = `SELECT id::text FROM users WHERE email = '${email}' LIMIT 1`;
  const result = await psqlQuery(sql);
  return result || null;
}

/**
 * Find the most recent user message row created after `sinceEpochSec`
 * for a given user. Returns the conversation_id.
 */
export async function getNewestUserConvId(userId: string, sinceEpochSec: number): Promise<string | null> {
  const sql = `SELECT conversation_id FROM agent_conversations WHERE user_id = '${userId}'::uuid AND role = 'user' AND from_agent = 'user' AND created_at >= to_timestamp(${sinceEpochSec - 2}) ORDER BY created_at DESC LIMIT 1`;
  const result = await psqlQuery(sql);
  return result || null;
}

/**
 * Poll until Francis has an assistant row with tool_calls populated,
 * or until timeout. Returns the row or null.
 */
export async function waitForFrancisAssistant(
  convId: string,
  userId: string,
  opts: { timeoutMs: number; intervalMs?: number } = { timeoutMs: 70_000 },
): Promise<DbRow | null> {
  const { timeoutMs, intervalMs = 2_000 } = opts;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await getThreadRows(convId, userId).catch(() => []);
    const assistant = rows.find((r) => r.role === 'assistant' && Array.isArray(r.tool_calls) && r.tool_calls.length > 0);
    if (assistant) return assistant;
    // Also accept an assistant row with any tool_calls (even empty) after 20s
    if (Date.now() - (deadline - timeoutMs) > 20_000) {
      const anyAssistant = rows.find((r) => r.role === 'assistant');
      if (anyAssistant) return anyAssistant;
    }
    await new Promise<void>((res) => setTimeout(res, intervalMs));
  }
  return null;
}

/** No-op — no connection pool to close with psql subprocess approach. */
export async function closeSql(): Promise<void> {
  // nothing
}
