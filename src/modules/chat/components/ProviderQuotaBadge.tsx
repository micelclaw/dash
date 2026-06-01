/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * ProviderQuotaBadge (F3.1 plan B) — chip in the chat toolbar showing
 * tokens consumed by the active agent's model in a configurable window
 * (1h / 24h / 7d / 30d). Powered by our own `token_usage` table.
 *
 * Why not the upstream `usage.status` RPC: it only covers subscription
 * providers (Claude Pro, GitHub Copilot, Gemini CLI, MiniMax, OpenAI
 * Codex, Xiaomi, Z.AI). Most setups use raw API keys (OpenRouter,
 * Google API, NVIDIA NIM, plain Anthropic key) which have no public
 * quota endpoint — that snapshot would always be empty for us.
 *
 * Our own counters cover ALL providers because we record one row per
 * turn in token_usage. The trade-off: we measure consumption, not
 * remaining quota — providers don't tell us the cap, so the badge
 * shows "tokens used so far this window" instead of "% remaining".
 */

import { useEffect, useMemo, useState } from 'react';
import { Gauge } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useChatStore } from '@/stores/chat.store';
import { getTokenUsageSummary } from '@/services/gateway.service';
import type {
  TokenUsageSummary,
  TokenUsageWindow,
  TokenUsageModelRow,
} from '@/services/gateway.service';

const POLL_MS = 60_000;
const WINDOWS: Array<{ value: TokenUsageWindow; label: string }> = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

/** Format absolute token count: 1234 → "1.2k", 1_234_567 → "1.2M". */
function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Format USD: 0 → "free", 0.0123 → "$0.012", 12.34 → "$12.34". */
function fmtCost(usd: number): string {
  if (usd <= 0) return 'free';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Match the agent's model string against the rows. The agent.model
 * tends to be fully-qualified ("openai/gpt-oss-120b:free") while DB
 * rows may or may not carry the prefix. Try exact first, then strip
 * prefix, then any row that ends with the same suffix.
 */
function findRowForAgentModel(
  rows: TokenUsageModelRow[],
  model: string | undefined,
): TokenUsageModelRow | null {
  if (!model || rows.length === 0) return null;
  const exact = rows.find((r) => r.model === model);
  if (exact) return exact;
  const bare = model.includes('/') ? model.slice(model.indexOf('/') + 1) : model;
  const bareMatch = rows.find((r) => r.model === bare || r.model.endsWith('/' + bare));
  if (bareMatch) return bareMatch;
  return null;
}

export function ProviderQuotaBadge() {
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const agents = useChatStore((s) => s.agents);
  const activeModel = useMemo(
    () => agents.find((a) => a.name === selectedAgent)?.model,
    [agents, selectedAgent],
  );

  const [window, setWindow] = useState<TokenUsageWindow>('24h');
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await getTokenUsageSummary(window);
        if (!cancelled) setSummary(s);
      } catch {
        // Silent — if Core is down the badge just doesn't render.
      }
    }
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [window]);

  const activeRow = useMemo(
    () => (summary ? findRowForAgentModel(summary.models, activeModel) : null),
    [summary, activeModel],
  );

  if (!summary) return null;
  // Show badge as long as there is ANY usage in the window. If a brand
  // new install has nothing recorded yet, hide silently.
  if (summary.totals.tokens_total === 0) return null;

  // Headline: tokens consumed by the active model (if matched) or the
  // top-consuming model (when the agent's model hasn't fired yet).
  const headlineRow = activeRow ?? summary.models[0];
  const headlineLabel = activeRow
    ? `${fmtTokens(headlineRow.tokens_total)} · ${headlineRow.requests}r`
    : `${fmtTokens(summary.totals.tokens_total)} · ${summary.totals.requests}r`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Token usage ${window}`}
          title={
            activeRow
              ? `${headlineRow.model}: ${headlineRow.tokens_total.toLocaleString()} tokens in last ${window}`
              : `Total ${window}: ${summary.totals.tokens_total.toLocaleString()} tokens`
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: open ? 'var(--surface-hover)' : 'transparent',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-dim)',
          }}
        >
          <Gauge size={14} />
          <span style={{ fontWeight: 600 }}>{headlineLabel}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>· {window}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} style={{ width: 380, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Token usage</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWindow(w.value)}
                style={{
                  padding: '2px 6px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: window === w.value ? 'var(--surface-hover)' : 'transparent',
                  color: window === w.value ? 'var(--text)' : 'var(--text-dim)',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          {new Date(summary.from).toLocaleString()} → {new Date(summary.to).toLocaleString()}
        </div>
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          {summary.models.length === 0 && (
            <div style={{ padding: '12px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              No usage in this window.
            </div>
          )}
          {summary.models.map((m) => {
            const isActive = activeRow?.model === m.model;
            return (
              <div
                key={m.model}
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                  background: isActive ? 'var(--surface-hover)' : 'transparent',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span
                    style={{
                      fontWeight: isActive ? 600 : 500,
                      fontFamily: 'var(--font-mono, monospace)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                    }}
                    title={m.model}
                  >
                    {m.model}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{m.requests} req</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    in {fmtTokens(m.tokens_input)} · out {fmtTokens(m.tokens_output)}
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>
                    {fmtTokens(m.tokens_total)} · {fmtCost(m.cost_usd)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <span>Total</span>
          <span>
            {fmtTokens(summary.totals.tokens_total)} · {summary.totals.requests} req ·{' '}
            {fmtCost(summary.totals.cost_usd)}
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Local count — covers all providers (we record per turn). Upstream `usage.status` only
          tracks subscription/OAuth providers and is not used here.
        </div>
      </PopoverContent>
    </Popover>
  );
}
